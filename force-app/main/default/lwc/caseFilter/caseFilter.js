import { LightningElement, api, track } from 'lwc';
import LightningModal from 'lightning/modal';
import CreateCaseFilter from '@salesforce/apex/CaseManagementClass.CreateCaseFilter';	
import LightningAlert from 'lightning/alert';

export default class MyModal extends LightningModal {
    @api title = 'Confirmation';
    @api UID;
    @api FilterUpdateInfo;
    @track InpArray = [1];
    @track count = 1;
    @track ShowCustomLogic = true;
    @track filterquery;
    renderedFirst=true;

    async showAlert(label,msg,theme) {
        await LightningAlert.open({
            message: msg,
            theme: theme, // Can be 'error', 'warning', 'info', 'success'
            label: label
        });
    }

    handleCancel() {
        this.close('cancel');
    }

    handleConfirm() {
        this.close('confirm');
    }

    AddFilterRow(){
        console.log('clciked');
        this.count+=1;
        this.InpArray.push(this.count);
    }

    removeRow(event) {
        const rowId = parseInt(event.target.dataset.id, 10);
        this.InpArray = this.InpArray.filter(row => row !== rowId);
    }

    connectedCallback(){
        if(this.FilterUpdateInfo.IsUpdate){
            this.InpArray = [];
            this.FilterUpdateInfo.filters.forEach((i,j)=>{
                this.InpArray.push(parseInt(i.rownumber));
                /*if(j<this.FilterUpdateInfo.filters.length-1){
                    this.InpArray.push(j+2);
                    //this.count+=1;
                }*/
            })
            this.count = parseInt(this.InpArray[this.InpArray.length-1]);
        }
    }

    renderedCallback() {
        console.log(this.renderedFirst);
        if (this.FilterUpdateInfo?.IsUpdate && this.renderedFirst) {
            this.renderedFirst = false;
            const editrows = this.template.querySelectorAll('.filter-row');
            
            if (editrows.length === this.FilterUpdateInfo.filters.length) {
                editrows.forEach((row, index) => {
                    row.querySelector('.field').value = this.FilterUpdateInfo.filters[index].field;
                    row.querySelector('.operator').value = this.FilterUpdateInfo.filters[index].operator;
                    row.querySelector('.value').value = this.FilterUpdateInfo.filters[index].value;
                });
            }
            if(this.FilterUpdateInfo.customLogic !== 'undefined' && this.FilterUpdateInfo.customLogic != '' && this.FilterUpdateInfo.customLogic != null){
                this.template.querySelector(".logic").value = this.FilterUpdateInfo?.customLogic;
            }
        }
    }
    

    async handleConfirm(event) {
        let CustomLogic = this.template.querySelector(".logic")?.value.toUpperCase() || '';
        /*if(this.ShowCustomLogic && (CustomLogic === null || CustomLogic === '' || CustomLogic === undefined)){
           alert('Please enter custom logic');
        }*/
        const btn = event.target.dataset.name;
        const rows = this.template.querySelectorAll('.filter-row');
        let selectedValues = [];

        rows.forEach(row => {
            let field = row.querySelector('.field')?.value || '';
            let operator = row.querySelector('.operator')?.value || '';
            let value = row.querySelector('.value')?.value || '';
            let rownumber = row.querySelector('.row-number').value; 
            selectedValues.push({ field, operator, value, rownumber });
        });
        console.log('Selected Values:', selectedValues);
        let FilterQuery={};
        let FinalQuery='';
        let DefaultLogic = '';
        let InputCount = selectedValues.length;
        selectedValues.forEach((i,j)=>{
            DefaultLogic += j+1!=InputCount ? `${i.rownumber} AND ` : `${i.rownumber}`;
        });
        selectedValues.forEach((i,j)=>{
            FilterQuery[i.rownumber] = i.operator !== 'like' ? `${i.field} ${i.operator} '${i.value}'` : `${i.field} ${i.operator} '%${i.value}%'`;  
        })
        //validation start
        const regex = /^(\d+|AND|OR|\(|\)|\s)*$/;
        if(this.ShowCustomLogic && CustomLogic){
            const cFilterLogic = CustomLogic.match(/\d+/g).map(Number).sort();
            const cRowNumbers = selectedValues.map(i=>parseInt(i.rownumber)).sort();
            let IsMatch = true;
            if(cFilterLogic.length == cRowNumbers.length && regex.test(CustomLogic)){
                for(let i=0;i<cFilterLogic.length;i++){
                    if(cFilterLogic[i]!==cRowNumbers[i]){
                        IsMatch = false;
                        break;
                    }
                }
            }
            else{
                IsMatch = false;
            }

            if(IsMatch===false){
                this.showAlert('Enter valid Custom Logic','Please ensure following,\n\n(1) Row Numbers and Custom Logic did not match. Please use only available row numbers in Custom Logic.\n\n(2) Do not user any special characters or words other then this example. EX : 1 AND (2 OR 3) AND 4','error');
                return;
            }
        }
        //validation end
        let Logic = this.ShowCustomLogic && CustomLogic ? CustomLogic : DefaultLogic;
        FinalQuery = Logic.replace(/\b\d+\b/g, match => FilterQuery[match] || match);
        console.log(FinalQuery);
        if(btn==='run'){
            this.close(FinalQuery);
        }
        else if(btn === 'save'){
            const FiletrName = this.template.querySelector('.InpName')?.value || '';
            if(!FiletrName && !this.FilterUpdateInfo.IsUpdate){
                this.showAlert('Error','Please enter the filter name','error');
            }
            else{
                const FilterId = !this.FilterUpdateInfo.IsUpdate ? null : this.FilterUpdateInfo.filterId;
                console.log(CustomLogic);
                await CreateCaseFilter({owner:this.UID,filters:JSON.stringify(selectedValues),q:FinalQuery,FName:FiletrName,logic:CustomLogic,FId:FilterId})
                .then(result=>{
                    console.log('saved',result);
                })
                .catch(error=>{
                    console.log(error);
                })
                this.close(FinalQuery);
            }
        }
    }

    HandleCustomLogic(event){
        this.ShowCustomLogic = event.target.checked;
    }

    deleteSavedFilter(){
        this.showAlert('Do you want delete this filter','','info');
        console.log('Alert');
    }

}
