import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';

export default class CaseDetails extends LightningElement {
    @track CaseNumber;
    fields = ['Subject','CaseNumber','CreatedById','Description'];
    @track Disabled = true;
    @wire(CurrentPageReference)
    getStateParameters(currentPageRef) {
        if (currentPageRef && currentPageRef.state) {
            this.CaseNumber = currentPageRef.state.c__caseNumber;
        }
    }
    
    HandleEditCase(event){
        const btn = event.target.dataset.name;
        if(btn === "cancel"){
            console.log(btn)
            const inputFields = this.template.querySelectorAll('lightning-input-field');
            if (inputFields) {
                inputFields.forEach(field => {
                    field.reset();
                });
            }
            this.Disabled = true;
        }
        else if(btn === "edit"){
            this.Disabled = false;
        }
    }
    HandleFormSuccess(){
        this.Disabled = true;
    }
}