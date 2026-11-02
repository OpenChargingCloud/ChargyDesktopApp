import {TrustAnchor,TrustContext,HistoricalTrustContext,TrustTransition,VerifiedTrustTransition,KeyStatement,POIPublicKey,initialTrustEpoch,canonicalJSONBytes,hash,toHex,parseJSON,prettyJSON} from '@open-charging-cloud/wwcp-poi';
import type {JSONObject,JSONValue} from '@open-charging-cloud/wwcp-poi';
import type {StoredTrustAnchor} from './trustStore';
import type {StoredTrustAnchorData} from './trustAnchorData';
import {parseTrustAnchorData,keyStatementURL} from './trustAnchorData';
import {trustedAnchorHolders} from './anchorKeyTrust';
import {trustAnchorStorageId} from './trustStore';
import type {POITrustContext,POIHistoricalContext} from './poiTrustContext';

/** Reconstruct the complete chain from today's local roots and original, explicitly accepted certificates. */
export function derivePOITrustLineage(anchor:TrustAnchor,document:StoredTrustAnchorData,record:StoredTrustAnchor,bundled:readonly POIPublicKey[],deleted:ReadonlySet<string>,at:number,historical:boolean):POITrustContext|POIHistoricalContext {
    if(record.id!==trustAnchorStorageId(anchor)||trustAnchorStorageId(TrustAnchor.parse(record.qrCode))!==record.id||!Number.isFinite(at)||record.transitions?.length===0||record.transitions===undefined)throw new Error('Invalid trust-lineage reference');
    const original=parseTrustAnchorData(anchor,document,bundled),first=TrustTransition.parse(parseJSON(record.transitions[0]?.text??'null'));
    const raw=parseJSON(document.text) as JSONObject;
    let activeAnchor=anchor,operator=(raw['operator']??(raw['keyStatement']===undefined?{'@id':original.statement.roamingNetworkOperatorId,minConsensus:original.statement.minConsensus,keyStatement:original.statement.json,identityKeys:original.statement.identityKeys.map(key=>key.json),signingKeyCertificates:[]}:raw)) as JSONObject,
        statement=original.statement,epoch=initialTrustEpoch(),previous:string|undefined;
    const root=TrustContext.create(anchor,statement,{trustedIdentityKeyIds:trustedAnchorHolders(anchor,record,bundled,deleted,first.signedAt).flat(),otherIdentityKeys:original.identityKeys,at:first.signedAt});
    let authorized=root.authorizedAnchor.keys,from=statement.signedAt;let epochs=[epoch];
    const transitions:VerifiedTrustTransition[]=[],authorities:{context:TrustContext;from:number;until:number}[]=[];
    for(const [index,saved]of record.transitions.entries()){
        const transition=TrustTransition.parse(parseJSON(saved.text));if(transition.signedAt<=from||transition.signedAt>at)throw new Error('Trust transitions must have increasing non-future effective times');
        const old=TrustContext.withEpoch(TrustContext.create(activeAnchor,statement,{trustedIdentityKeyIds:authorized,otherIdentityKeys:POIPublicKey.parseAll(operator['identityKeys'],'Operator identity keys'),at:transition.signedAt}),epoch,epochs);
        const verified=VerifiedTrustTransition.verify(old,operator,transition,{acceptedAt:Date.parse(saved.acceptedAt),epoch,sequence:index,previous});
        authorities.push({context:old,from,until:transition.signedAt});transitions.push(verified);
        activeAnchor=transition.anchor;operator=transition.operator;statement=KeyStatement.parse(operator['keyStatement']);epoch=verified.epoch;
        authorized=verified.context.authorizedAnchor.keys;epochs=[...verified.context.epochs];previous=transition.digest();from=transition.signedAt;
    }
    const current=TrustContext.withEpoch(TrustContext.create(activeAnchor,statement,{trustedIdentityKeyIds:authorized,otherIdentityKeys:POIPublicKey.parseAll(operator['identityKeys'],'Operator identity keys'),at:historical?from:at}),epoch,epochs);
    authorities.push({context:current,from,until:Infinity});
    const verification=historical?HistoricalTrustContext.fromVerifiedAuthorities(current,authorities,at):current;
    const policyId=trustAnchorStorageId(anchor),networkIdentity=toHex(hash('sha256',canonicalJSONBytes({roamingNetworkId:current.roamingNetworkId,roamingNetworkOperatorId:current.roamingNetworkOperatorId,anchorPolicyId:policyId})));
    return Object.freeze({verification,anchorPolicyId:policyId,networkIdentity,roamingNetworkId:current.roamingNetworkId,roamingNetworkOperatorId:current.roamingNetworkOperatorId,
        keyStatementDigest:verification.keyStatementDigest,evaluatedAt:at,validUntil:verification.validUntil,requiredConsensus:current.requiredConsensus,authorizedHolders:current.trustedHolders,
        epoch:epoch.number,epochProfiles:epoch.profiles,verifiedTransitions:Object.freeze(transitions),effectivePolicyId:trustAnchorStorageId(activeAnchor),
        evidence:Object.freeze({anchorQRCode:activeAnchor.toQRCode(),bootstrapAnchorQRCode:anchor.toQRCode(),keyStatement:{origin:'embedded' as const,text:prettyJSON(operator),sourceURL:keyStatementURL(activeAnchor.urls[0]??''),downloadedAt:record.transitions.at(-1)?.acceptedAt??document.downloadedAt}})}) as POITrustContext|POIHistoricalContext;
}
export function lineageOperator(context:POITrustContext|POIHistoricalContext):JSONObject {
    const value=parseJSON(context.evidence.keyStatement.text) as JSONObject;
    return (value['operator']??value) as JSONObject;
}
export function transitionDigest(value:JSONValue):string{return TrustTransition.parse(value).digest();}
