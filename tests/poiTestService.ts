import {POITrustService} from '../src/ts/poiTrustContext';
import {MemoryPOIObservedHistory} from '../src/ts/poiObservedHistory';
import {MemoryWitnessPolicy} from '../src/ts/poiWitnessTrust';
export class TestPOITrustService extends POITrustService {
    public constructor(store:ConstructorParameters<typeof POITrustService>[0],keys:ConstructorParameters<typeof POITrustService>[1],now?:()=>number,history=new MemoryPOIObservedHistory(),witnesses:ConstructorParameters<typeof POITrustService>[4]=new MemoryWitnessPolicy()){super(store,keys,now,history,witnesses);}
}
