import type {VersionComparison} from '@open-charging-cloud/wwcp-poi';
export function renderPOIConsistency(report:VersionComparison,localize:(key:string)=>string):HTMLElement {
    const root=document.createElement('section');root.className='poiConsistency';root.dataset['state']=report.accepted?'valid':'invalid';root.dataset['status']=report.status;
    root.appendChild(document.createElement('p')).textContent=(report.accepted?'✅ ':'❌ ')+localize(report.accepted?report.status==='historical'?'poiObservedHistorical':'poiObservedConsistent':'poiObservedRejected');
    const details=root.appendChild(document.createElement('details'));details.appendChild(document.createElement('summary')).textContent=localize('poiObservedDetails');
    details.appendChild(document.createElement('p')).textContent=localize('poiObservedLimits');
    for(const issue of report.issues)details.appendChild(document.createElement('p')).textContent=issue.code+' · '+issue.chain+' · '+issue.detail;
    return root;
}
