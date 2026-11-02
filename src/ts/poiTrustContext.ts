import {POIObservedHistoryStore} from './poiObservedHistory';
import type {ObservationScope,ObservedHistoryRepository} from './poiObservedHistory';
import {applyVerifiedTrustTransition,verifyChargingDocumentKeys,ChargingStationProof, Checkpoint, PriceStatement, parseHistoricalMeterEvidence, parseSessionPriceEvidence, verifyAuthorizedCheckpoint, verifyPriceStatements, stationVersionObservation, checkpointVersionObservation, priceVersionObservation, checkpointRootVersionObservation, OperatorTrust, TrustAnchor, TrustContext, HistoricalTrustContext, canonicalJSONBytes, hash, toHex, verifyChargingStation, verifyMeterKey, verifyHistoricalMeterEvidence, verifySessionPriceEvidence } from '@open-charging-cloud/wwcp-poi';
import {derivePOITrustLineage} from './poiTrustLineage';
import type {ObservedVersions,VersionObservation,VersionComparison,SessionPriceRequest,SessionPriceVerification, EpochProfiles,VerifiedTrustTransition} from '@open-charging-cloud/wwcp-poi';
import type { JSONValue, POIPublicKey, VerifiedChargingStation, VerifiedMeterKeyBinding, MeasurementKeyFormat, HistoricalMeterVerification } from '@open-charging-cloud/wwcp-poi';
import { trustedAnchorHolders } from './anchorKeyTrust';
import { parseTrustAnchorData } from './trustAnchorData';
import type { StoredTrustAnchorData } from './trustAnchorData';
import { trustAnchorStorageId } from './trustStore';
import type { StoredTrustAnchor, TrustStore } from './trustStore';
import {POIWitnessTrustStore} from './poiWitnessTrust';
import type {WitnessPolicyRepository} from './poiWitnessTrust';

/** An immutable report at evaluatedAt, never a reusable authorization token or a stored green flag. */
export interface POITrustContext {
    readonly epoch?:number;readonly epochProfiles?:EpochProfiles;readonly verifiedTransitions?:readonly VerifiedTrustTransition[];readonly effectivePolicyId?:string;
    readonly verification: TrustContext;
    readonly anchorPolicyId: string;
    /** Conservatively scoped to this exact bootstrap policy until verified succession is supported. */
    readonly networkIdentity: string;
    readonly roamingNetworkId: string;
    readonly roamingNetworkOperatorId: string;
    readonly keyStatementDigest: string;
    readonly evaluatedAt: number;
    readonly validUntil: number;
    readonly requiredConsensus: number;
    /** Original holder positions are retained, including empty groups. */
    readonly authorizedHolders: readonly (readonly string[])[];
    readonly evidence: {
        readonly bootstrapAnchorQRCode?:string;
        readonly anchorQRCode: string;
        readonly keyStatement: StoredTrustAnchorData;
    };
}
export interface POIHistoricalContext extends Omit<POITrustContext,'verification'> {
    readonly verification: HistoricalTrustContext;
}

const digest = (value: JSONValue): string => toHex(hash('sha256', canonicalJSONBytes(value)));

/** Reparse original evidence; callers cannot substitute a pre-parsed statement or cached verification result. */
export function createPOITrustContext(anchor: TrustAnchor, document: StoredTrustAnchorData,
                                        record: StoredTrustAnchor | undefined, bundled: readonly POIPublicKey[],
                                        deleted: ReadonlySet<string>, at: number = Date.now()): POITrustContext {
    if (!Number.isFinite(at))
        throw new Error('Invalid POI trust evaluation time');
    if(record!==undefined&&(record.transitions?.length??0)>0)return derivePOITrustLineage(anchor,document,record,bundled,deleted,at,false) as POITrustContext;
    if (record !== undefined && (record.id !== trustAnchorStorageId(anchor) ||
        trustAnchorStorageId(TrustAnchor.parse(record.qrCode)) !== record.id))
        throw new Error('The stored trust decision belongs to another anchor policy');
    const data = parseTrustAnchorData(anchor, document, bundled);
    const verification = TrustContext.create(anchor, data.statement, {
        trustedIdentityKeyIds: trustedAnchorHolders(anchor, record, bundled, deleted, at).flat(),
        otherIdentityKeys: data.identityKeys, at
    });
    const anchorPolicyId = trustAnchorStorageId(anchor);
    const roamingNetworkId = data.statement.roamingNetworkId;
    const roamingNetworkOperatorId = data.statement.roamingNetworkOperatorId;
    return Object.freeze({
        verification,
        anchorPolicyId,
        networkIdentity: digest({ roamingNetworkId, roamingNetworkOperatorId, anchorPolicyId }),
        roamingNetworkId, roamingNetworkOperatorId,
        keyStatementDigest: verification.keyStatementDigest,
        evaluatedAt: verification.evaluatedAt, validUntil: verification.validUntil, requiredConsensus: verification.requiredConsensus,
        authorizedHolders: verification.trustedHolders,
        evidence: Object.freeze({ anchorQRCode: anchor.toQRCode(), keyStatement: Object.freeze({ ...document }) })
    });
}

export class POIHistoryError extends Error {
    public constructor(public readonly report:VersionComparison){super('Local version history rejected: '+report.issues.map(issue=>issue.code+': '+issue.detail).join('; '));this.name='POIHistoryError';}
}
export interface POIObservationTicket {readonly context:POITrustContext|POIHistoricalContext;readonly scope:ObservationScope;readonly generation:string;readonly historical:boolean;readonly observed:ObservedVersions;}
/** Storage-backed gateway. Every call reads current local decisions in one transaction; no authorization cache. */
export class POITrustService {
    public async previewTrustTransition(policyId:string,text:string,acceptedAt:number=this.now()):Promise<{
        readonly record:StoredTrustAnchor;readonly deleted:ReadonlySet<string>;readonly context:POITrustContext;readonly transition:VerifiedTrustTransition;readonly consistency:VersionComparison;readonly acceptedAt:string;
    }>{
        if(new TextEncoder().encode(text).length>2*1024*1024)throw new Error('Trust-transition input exceeds 2 MiB');
        const {record,deleted}=await this.store.trustSnapshot(policyId);if(record?.downloadedData===undefined)throw new Error('A saved authorized bootstrap is required');
        const accepted=new Date(acceptedAt).toISOString(),candidate={...record,transitions:[...record.transitions??[],{text,acceptedAt:accepted}]};
        const context=derivePOITrustLineage(TrustAnchor.parse(record.qrCode),record.downloadedData,candidate,this.bundled,deleted,this.now(),false) as POITrustContext;
        const transition=context.verifiedTransitions?.at(-1);if(transition===undefined)throw new Error('No verified trust transition');
        const scope={id:context.networkIdentity,policyId,roamingNetworkId:context.roamingNetworkId,operatorId:context.roamingNetworkOperatorId};
        let state=(await this.history.begin(scope)).state,consistency:VersionComparison|undefined;
        for(const item of context.verifiedTransitions??[]){consistency=applyVerifiedTrustTransition(state,item,this.now());state=consistency.state;if(!consistency.accepted)break;}
        if(consistency===undefined)throw new Error('Missing transition comparison');return {record,deleted,context,transition,consistency,acceptedAt:accepted};
    }
    public validateTransitionAppend(record:StoredTrustAnchor,deleted:ReadonlySet<string>,text:string,acceptedAt:string):void {
        if(record.downloadedData===undefined)throw new Error('Missing bootstrap');
        derivePOITrustLineage(TrustAnchor.parse(record.qrCode),record.downloadedData,{...record,transitions:[...record.transitions??[],{text,acceptedAt}]},this.bundled,deleted,this.now(),false);
    }
    public async verifyLiveDocumentKeys(policyId:string,proof:JSONValue,request:{readonly evseId:string;readonly operatorId:string;readonly at:number},signal?:AbortSignal):Promise<ReturnType<typeof verifyChargingDocumentKeys>>{
        const ticket=await this.beginObservations(policyId,true,signal),keys=verifyChargingDocumentKeys(ticket.context.verification,proof,request);
        const cutoff=ticket.context.verifiedTransitions?.at(-1)?.source.signedAt??Infinity;
        const consistency=await this.recordObservations(ticket,[this.stationPoint(ticket,ChargingStationProof.parse(proof),request.at<cutoff)],'historical',{signal});
        if(!consistency.accepted)throw new POIHistoryError(consistency);return keys;
    }
    private stationPoint(ticket:POIObservationTicket,proof:ChargingStationProof,historical:boolean,checkpoints:readonly Checkpoint[]=[]):VersionObservation {
        const known=ticket.observed.points.find(point=>point.kind==='station'&&point.digest===proof.commitId);
        const cp=checkpoints.find(item=>item.commitId===proof.commitId),epoch=cp===undefined?known?.epoch:cp.epoch===1?'':String(cp.epoch);
        if(historical&&(ticket.context.epoch??1)>1&&epoch===undefined)throw new Error('An unknown historical commit needs authenticated checkpoint evidence naming its epoch');
        return stationVersionObservation(proof,epoch??((ticket.context.epoch??1)===1?'':String(ticket.context.epoch)));
    }
    private authenticatedCheckpoints(context:POIHistoricalContext|POITrustContext,entries:readonly {readonly checkpoint:JSONValue;readonly operator:JSONValue}[]):Checkpoint[]{
        return entries.flatMap(entry=>{try{return [verifyAuthorizedCheckpoint(context.verification,Checkpoint.parse(entry.checkpoint),entry.operator).checkpoint];}catch{return [];}});
    }
    public constructor(private readonly store: Pick<TrustStore, 'trustSnapshot'>,
                        private readonly bundled: readonly POIPublicKey[],
                        private readonly now: () => number = Date.now,
                        private readonly history:ObservedHistoryRepository=new POIObservedHistoryStore(),
                        private readonly witnessPolicies:WitnessPolicyRepository=new POIWitnessTrustStore()) {}

    public async assertPublicationPolicy(revision:string):Promise<void>{
        if((await this.witnessPolicies.snapshot()).revision!==revision)throw new Error('Witness authorization changed during verification');
    }

    public async resolve(anchorPolicyId: string): Promise<POITrustContext> {
        const { record, deleted } = await this.store.trustSnapshot(anchorPolicyId);
        if (record?.id !== anchorPolicyId || record.downloadedData === undefined)
            throw new Error('No saved KeyStatement exists for this anchor policy');
        return createPOITrustContext(TrustAnchor.parse(record.qrCode), record.downloadedData,
                                     record, this.bundled, deleted, this.now());
    }

    public async resolveHistorical(anchorPolicyId: string): Promise<POIHistoricalContext> {
        const { record,deleted } = await this.store.trustSnapshot(anchorPolicyId);
        if (record?.id !== anchorPolicyId || record.downloadedData === undefined) throw new Error('No saved reference statement for this historical policy');
        if((record.transitions?.length??0)>0)return derivePOITrustLineage(TrustAnchor.parse(record.qrCode),record.downloadedData,record,this.bundled,deleted,this.now(),true) as POIHistoricalContext;
        const anchor = TrustAnchor.parse(record.qrCode);
        if (trustAnchorStorageId(anchor) !== anchorPolicyId) throw new Error('Historical policy identity mismatch');
        const data = parseTrustAnchorData(anchor,record.downloadedData,this.bundled);
        const now = this.now();
        const verification = HistoricalTrustContext.create(anchor,data.statement,{
            trustedIdentityKeyIds:trustedAnchorHolders(anchor,record,this.bundled,deleted,now).flat(),otherIdentityKeys:data.identityKeys,now
        });
        return Object.freeze({ verification,anchorPolicyId,
            networkIdentity:digest({roamingNetworkId:verification.roamingNetworkId,roamingNetworkOperatorId:verification.roamingNetworkOperatorId,anchorPolicyId}),
            roamingNetworkId:verification.roamingNetworkId,roamingNetworkOperatorId:verification.roamingNetworkOperatorId,
            keyStatementDigest:verification.keyStatementDigest,evaluatedAt:verification.evaluatedAt,validUntil:verification.validUntil,
            requiredConsensus:verification.requiredConsensus,authorizedHolders:verification.trustedHolders,
            evidence:Object.freeze({anchorQRCode:anchor.toQRCode(),keyStatement:Object.freeze({...record.downloadedData})}) });
    }

    public async beginObservations(anchorPolicyId:string,historical:boolean=true,signal?:AbortSignal):Promise<POIObservationTicket> {
        signal?.throwIfAborted();
        const context=historical?await this.resolveHistorical(anchorPolicyId):await this.resolve(anchorPolicyId);
        const scope:ObservationScope={id:context.networkIdentity,policyId:anchorPolicyId,roamingNetworkId:context.roamingNetworkId,operatorId:context.roamingNetworkOperatorId};
        let stored=await this.history.begin(scope);
        for(const transition of context.verifiedTransitions??[]){const result=await this.history.transition(scope,stored.generation,transition,this.now());if(!result.accepted)throw new POIHistoryError(result);}
        stored=await this.history.begin(scope);
        if((stored.state.transitions?.length??0)>(context.verifiedTransitions?.length??0))throw new Error('Accepted policy succession exists in the journal; restore its original certificates before checking current data');
        signal?.throwIfAborted();return {context,scope,generation:stored.generation,historical,observed:stored.state};
    }
    public async recordObservations(ticket:POIObservationTicket,points:readonly VersionObservation[],mode:'current'|'historical',
        options:{readonly signal?:AbortSignal|undefined;readonly live?:{readonly chain:string;readonly evidence:string};readonly validUntil?:number}={}):Promise<VersionComparison> {
        const fresh=async():Promise<void>=>{
            const current=ticket.historical?await this.resolveHistorical(ticket.context.anchorPolicyId):await this.resolve(ticket.context.anchorPolicyId);
            if(current.keyStatementDigest!==ticket.context.keyStatementDigest||current.effectivePolicyId!==ticket.context.effectivePolicyId||current.epoch!==ticket.context.epoch||current.requiredConsensus!==ticket.context.requiredConsensus||JSON.stringify(current.authorizedHolders)!==JSON.stringify(ticket.context.authorizedHolders)||
                current.evaluatedAt>Math.min(ticket.context.validUntil,options.validUntil??Infinity))throw new Error('Authorization changed or expired while recording observed versions');
            options.signal?.throwIfAborted();
        };
        await fresh();const report=await this.history.observe(ticket.scope,ticket.generation,points,mode,this.now(),options.live,options.signal);await fresh();return report;
    }
    private checkpoints(context:POIHistoricalContext|POITrustContext,entries:readonly {readonly checkpoint:JSONValue;readonly operator:JSONValue}[]):VersionObservation[] {
        return entries.flatMap(entry=>{const checkpoint=verifyAuthorizedCheckpoint(context.verification,Checkpoint.parse(entry.checkpoint),entry.operator).checkpoint;return [checkpointVersionObservation(checkpoint),checkpointRootVersionObservation(checkpoint)];});
    }
    public async verifyCurrentCheckpoints(anchorPolicyId:string,entries:readonly {readonly checkpoint:JSONValue;readonly operator:JSONValue}[]):Promise<VersionComparison> {
        if(entries.length===0)throw new Error('No current checkpoint evidence supplied');const ticket=await this.beginObservations(anchorPolicyId,false);
        const points=this.checkpoints(ticket.context,entries),report=await this.recordObservations(ticket,points,'current');if(!report.accepted)throw new POIHistoryError(report);return report;
    }
    public async verifyCurrentPrices(anchorPolicyId:string,proof:JSONValue,statements:readonly JSONValue[],evseId:string):Promise<{readonly consistency:VersionComparison}> {
        if(statements.length===0)throw new Error('No signed current price statements supplied');
        const ticket=await this.beginObservations(anchorPolicyId,false),station=verifyChargingStation((ticket.context as POITrustContext).verification,proof,{evseId});
        verifyPriceStatements(station,[...statements],{at:ticket.context.evaluatedAt});
        const points=[this.stationPoint(ticket,ChargingStationProof.parse(proof),false),...statements.map(item=>priceVersionObservation(PriceStatement.parse(item)))];
        const consistency=await this.recordObservations(ticket,points,'current');if(!consistency.accepted)throw new POIHistoryError(consistency);return {consistency};
    }

    public async verifyOperator(anchorPolicyId: string, operator: JSONValue): Promise<{ readonly context: POITrustContext; readonly trust: OperatorTrust }> {
        const context = await this.resolve(anchorPolicyId);
        return { context, trust: OperatorTrust.fromOperatorJSON(context.verification, operator) };
    }

    public async verifyMeterKey(anchorPolicyId: string, proof: JSONValue, request: {
        readonly evseId: string; readonly meterSerialNumber: string; readonly keyFormat: MeasurementKeyFormat;
    },signal?:AbortSignal): Promise<{ readonly context: POITrustContext; readonly binding: VerifiedMeterKeyBinding }> {
        const ticket=await this.beginObservations(anchorPolicyId,false,signal),context=ticket.context as POITrustContext;
        const binding=verifyMeterKey(context.verification,proof,request);
        const consistency=await this.recordObservations(ticket,[this.stationPoint(ticket,ChargingStationProof.parse(proof),false)],'current',{signal,validUntil:binding.evidence.validUntil});
        if(!consistency.accepted)throw new POIHistoryError(consistency);return {context,binding};
    }

    public async verifyHistoricalMeterEvidence(anchorPolicyId: string, evidence: JSONValue, request: {
        readonly evseId: string; readonly meterSerialNumber: string; readonly measurementTimes: readonly number[];
        readonly keyFormat: MeasurementKeyFormat;
    },signal?:AbortSignal): Promise<{ readonly context: POIHistoricalContext; readonly evidence: HistoricalMeterVerification;readonly consistency:VersionComparison }> {
        const ticket=await this.beginObservations(anchorPolicyId,true,signal),context=ticket.context as POIHistoricalContext;
        const verified=verifyHistoricalMeterEvidence(context.verification,evidence,request),parsed=parseHistoricalMeterEvidence(evidence);
        const used=new Set(verified.bindings.map(binding=>binding.evidence.commitId));
        const versions=parsed.versions.filter(version=>used.has(ChargingStationProof.parse(version.proof).commitId));
        const included=new Set(verified.versions.map(version=>version.checkpointId));
        const points=[...versions.map(version=>this.stationPoint(ticket,ChargingStationProof.parse(version.proof),true,this.authenticatedCheckpoints(context,version.checkpoints))),
            ...this.checkpoints(context,versions.flatMap(version=>version.checkpoints).filter(entry=>included.has(Checkpoint.parse(entry.checkpoint).id)))];
        const consistency=await this.recordObservations(ticket,points,'historical',{signal});return {context,evidence:verified,consistency};
    }

    public async verifySessionPriceEvidence(anchorPolicyId:string,evidence:JSONValue,request:SessionPriceRequest,
        relatedCheckpoints:readonly {readonly checkpoint:JSONValue;readonly operator:JSONValue}[]=[],signal?:AbortSignal):Promise<{readonly context:POIHistoricalContext;readonly price:SessionPriceVerification;readonly consistency:VersionComparison;readonly publicationPolicyRevision:string}>{
        const ticket=await this.beginObservations(anchorPolicyId,true,signal),context=ticket.context as POIHistoricalContext;
        const witnesses=await this.witnessPolicies.snapshot();signal?.throwIfAborted();
        const price=verifySessionPriceEvidence(context.verification,evidence,request,{relatedCheckpoints,publicationPolicy:witnesses.policy}),parsed=parseSessionPriceEvidence(evidence);
        const points=[this.stationPoint(ticket,ChargingStationProof.parse(parsed.proof),true,this.authenticatedCheckpoints(context,parsed.checkpoints))];
        if(price.signatures==='valid'&&price.applicability!=='invalid')points.push(...parsed.priceStatements.map(item=>priceVersionObservation(PriceStatement.parse(item))));
        if(price.publication==='valid'||price.publication==='incomplete')points.push(...this.checkpoints(context,parsed.checkpoints));
        const consistency=await this.recordObservations(ticket,points,'historical',{signal});
        await this.assertPublicationPolicy(witnesses.revision);signal?.throwIfAborted();
        return {context,price,consistency,publicationPolicyRevision:witnesses.revision};
    }

    /** Integration seam only: no fetching, station selection, caching or ChargyCore handoff here. */
    public async verifyStation(anchorPolicyId: string, value: JSONValue,
                                subject: { readonly evseId: string } | { readonly chargingStationId: string },signal?:AbortSignal): Promise<{
                                    readonly context: POITrustContext; readonly station: VerifiedChargingStation;readonly consistency?:VersionComparison;
                                }> {
        const ticket=await this.beginObservations(anchorPolicyId,false,signal),context=ticket.context as POITrustContext;
        if (('evseId' in subject ? subject.evseId : subject.chargingStationId).trim() === '')
            throw new Error('A station proof requires an unambiguous subject');
        const station = verifyChargingStation(context.verification, value, subject);
        const consistency=await this.recordObservations(ticket,[this.stationPoint(ticket,ChargingStationProof.parse(value),false)],'current',{signal,validUntil:station.verification.validUntil});
        if(!consistency.accepted)throw new POIHistoryError(consistency);return {context,station,consistency};
    }
}
