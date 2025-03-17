import { LightningElement,track } from 'lwc';
import CaseFilterModal from 'c/caseFilter';
import GetUserAssignedCases from '@salesforce/apex/CaseManagementClass.GetUserAssignedCases';
import GetUserCaseFilters from '@salesforce/apex/CaseManagementClass.GetUserCaseFilters';
import bulkCaseClosure from '@salesforce/apex/CaseManagementClass.bulkCaseClosure';
import Id from '@salesforce/user/Id';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';
import { NavigationMixin } from "lightning/navigation";
import { loadScript } from 'lightning/platformResourceLoader';
import sheetjs from '@salesforce/resourceUrl/sheetjs';
import LightningPrompt from 'lightning/prompt';
export default class CaseManagementDashboard extends NavigationMixin(LightningElement) {
    UserId = Id;
    @track Limit = 20;
    @track Offset = 0;
    @track Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
    @track where = `WHERE OwnerId = '${this.UserId}'`;
    BasicQuery = 'SELECT Id,CaseNumber,Subject,Priority,CreatedDate,Status FROM Case ';
    @track query = `${this.BasicQuery}${this.where}${this.Limits}`;
    @track UserFilters = [{label:'My Cases',value:'None'}];
    @track SelectedFilter;
    disableNextBtn = false;
    disablePrevBtn = true;
    @track totalRecs=0;
    page = 1;
    @track SelectedRows=[];
    load = false;

    @track Cases = [];
    actions = [
        { label: 'Edit', name: 'edit' },
    ];
    columns = [
        { label: 'Case Number', fieldName: 'CaseNumber',type: 'button',
            typeAttributes: {label:{fieldName:'CaseNumber'},variant: { fieldName: 'format' },name:'view'},
         },
        { label: 'Subject', fieldName: 'Subject', type: 'text' },
        { label: 'Priority', fieldName: 'Priority', type: 'text' },
        { label: 'Status', fieldName: 'Status', type: 'text' },
        { label: 'Created', fieldName: 'CreatedDate', type: 'date' },
        { label: 'Id', fieldName: 'Id', type: 'text', hideDefaultActions: true, fixedWidth: 1 },
        {
            type: 'action',
            typeAttributes: { rowActions: this.actions },
        },
    ];

    showToast(title,msg,varient) {
        const event = new ShowToastEvent({
            title: title,
            message: msg!==null ? msg : '',
            variant: varient,
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
    }

    handleLoading(){
        this.load = !this.load;
    }

    async GetAssigendCases(){
        console.log(this.query);
        this.handleLoading();
        await GetUserAssignedCases({q:this.query,WhereCondition:this.where,OffSet1:this.Offset})
        .then(result=>{
            if(result.count!=null){
                this.totalRecs = result.count;
            }
            const TempCases = result.records.map(ele => ({
                ...ele, // Create a new object
                format: ele.Priority !== 'High' ? 'brand-outline' : 'destructive-text'
            }));
            this.Cases = TempCases;
            console.log(this.totalRecs);
            this.disableNextBtn = (this.Offset + this.Limit) >= this.totalRecs;
            this.disablePrevBtn = this.Offset === 0;
        })
        .catch(error=>{
            console.log(error);
        })
        this.handleLoading();
    }
    async FetchUserFilters(){
        //this.handleLoading();
        try{
            const temp = await GetUserCaseFilters({UID:this.UserId});
            const values = temp.map(i=>({label:i.Name,value:`${i.Query__c}#${i.Id}#${i.Filter__c}#${i.Custom_Filter__c}`}));
            this.UserFilters = [...this.UserFilters,...values];
        }
        catch(error){
            console.log(error);
        }
        //this.handleLoading();
    }


    connectedCallback(){
        this.FetchUserFilters();
        this.GetAssigendCases();
    }

    async handleFilterOpenModal(event) {
        const btn = event.target.dataset.btn;
        if((btn==='newfilter') || (this.SelectedFilter && btn==='editfilter' && this.SelectedFilter!=='None')){
            const result = await CaseFilterModal.open({
                size: 'large', // 'small', 'medium', 'large'
                title: btn==='newfilter' ? 'New Filter' : 'Edit Filter',
                UID:this.UserId,
                FilterUpdateInfo: btn==='newfilter' ? {IsUpdate : false,filters:[],filterId:'',customLogic:null} : {IsUpdate : true,filters:JSON.parse(this.SelectedFilter.split("#")[2]),filterId:this.SelectedFilter.split("#")[1],customLogic:this.SelectedFilter.split("#")[3]},
    
            });
            console.log('Modal Result:', result);
            if(result!= undefined && result!=null && result!=''){
                //this.ResetLimits();
                //this.Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
                this.where = `WHERE ${result}`;
                this.query = this.ResetLimits(this.where,false,null);
                console.log(this.query);
                this.GetAssigendCases();
            }
        }
        else{
            this.showToast('This filter cannot be edited',null,'info');
        }
    }

    HandleFilterChange(event){
        //this.ResetLimits();
        //this.Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
        this.SelectedFilter = event.detail.value;
        const SelectedQuery = this.SelectedFilter.split("#")[0];
        this.where = this.SelectedFilter !== 'None' ? `WHERE ${SelectedQuery}` : `WHERE OwnerId = '${this.UserId}'`;
        this.query = this.ResetLimits(this.where,false,null);
        console.log(this.query);
        this.GetAssigendCases();
    }

    handleCaseSearch(){
        const keyWord  = this.template.querySelector('.search-case-inp').value;
        if(keyWord.length>=3){
            this.where = `WHERE CaseNumber LIKE '%${keyWord}%' OR Subject LIKE '%${keyWord}%'`;
            this.query = this.ResetLimits(this.where,false,null);
            this.GetAssigendCases();
        }
        else{
            this.showToast('Please enter atleast 3 charcters',null,'error');
        }
    }

    RefreshList(){
        this.GetAssigendCases();
    }

    HandleRowActions(event){
        const actionName = event.detail.action.name;
        const row = event.detail.row;
        if (actionName === 'view') {
            console.log('Navigating to Case: ', row.CaseNumber);
            this.NavCaseDetailPage(row);

        } else if (actionName === 'copy') {
            if (!navigator.clipboard) {
                this.showToast('Error', 'Clipboard API not supported', 'error');
                return;
            }
        } else if (actionName === 'delete') {
            console.log('Delete action clicked for:', row.CaseNumber);
        }
    }

    NavCaseDetailPage(row) {
        console.log(row.Id);
    
        // Generate the URL first
        this[NavigationMixin.GenerateUrl]({
            type: 'standard__component',
            attributes: {
                componentName: 'c__caseDetails',
            },
            state: {
                c__caseNumber: row.Id,
            }
        }).then(url => {
            // Open the generated URL in a new tab
            window.open(url, "_blank");
        });
    }

    async DownloadCsv() {
        let tempCases = [];
        const Cases = [];
        Cases.push(['Id','CaseNumber','Subject','Priority','CreatedDate','Status']);
        const query1 = `${this.BasicQuery}${this.where}`;
        await GetUserAssignedCases({q:query1,WhereCondition:this.where,OffSet1:1})
        .then(result =>{
            tempCases = result.records;
        })
        .catch(error=>{
            console.log(error);
        })

        tempCases.forEach(i=>{
            Cases.push([i.Id,i.CaseNumber,i.Subject,i.Priority,i.CreatedDate,i.Status]);
        })

        const title = `Export_Cases_${new Date().toString().slice(0,24).replaceAll(' ','-')}.xlsx`;
        await loadScript(this, sheetjs);
        var wb = XLSX.utils.book_new();
        var ws = XLSX.utils.aoa_to_sheet(Cases);
        XLSX.utils.book_append_sheet(wb, ws, "Cases");
        XLSX.writeFile(wb, title);
    }

    /*Next(){
        this.Offset += 20;
        //this.Limit += 20;
        this.Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
        this.query = `${this.BasicQuery}${this.where}${this.Limits}`
        console.log(this.Offset,this.Limit);
        console.log(this.query);
        this.GetAssigendCases();
        this.page+=1;
        //this.Cases.length !== 0 ? this.page+=1 : this.page;
        //this.disablePrevBtn=false;
        console.log(this.page);
    }

    Prev(){
        this.Offset -= 20;
       // this.Limit = 20;
        this.Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
        this.query = `${this.BasicQuery}${this.where}${this.Limits}`
        console.log(this.Offset,this.Limit);
        console.log(this.query);
        this.GetAssigendCases();
        this.page-=1;
        /*this.disableNextBtn = false;
        if(this.page===1){
            this.disablePrevBtn=true;
        }//
        console.log(this.page);
    }*/

    handlePagination(event){
        const action = event.target.dataset.btn;
        //this.Offset = action === "next" ? this.Offset+=20 : this.Offset-=20;
        this.query = this.ResetLimits(this.where,true,action);
        this.GetAssigendCases();
    }

    ResetLimits(WhereCondition,IsPagination,paginationAction){
        if(!IsPagination){
            this.Limit = 20;
            this.Offset = 0;
            this.page = 1;
        }
        else if(IsPagination){
            if(paginationAction==="next"){
                this.Offset+=20;
                this.page+=1;
            }
            else if(paginationAction==="prev"){
                this.Offset-=20;
                this.page-=1;
            }
        }
        this.Limits = ` LIMIT ${this.Limit} OFFSET ${this.Offset}`;
        const NewQuery = `${this.BasicQuery}${WhereCondition}${this.Limits}`;
        return NewQuery;
    }
    
   handleCloseCases(){
    const SelectedRowsCount = this.SelectedRows.length;
    const toastMsg = SelectedRowsCount!=0 ? 'Please provide reason below for bulk case closure' : 'Select atleast one row';
    LightningPrompt.open({
            message: 'Bulk case closure comment (required) :',
            label: `Do want to cslose ${SelectedRowsCount} case(s)?`,
            theme : 'inverse', 
            //defaultValue: 'Bulk Case Close', 
        }).then(async(result) => {
            console.log(result);
            console.log(this.SelectedRows);
            if(result !== '' && result !== null && SelectedRowsCount>0){
                const activeCases = [];
                this.SelectedRows.forEach(i =>{
                    if(i.Status != 'Closed'){
                        activeCases.push(i.Id);
                    }
                })
                if(activeCases.length>0){
                    let CaseCloseResult = 0;
                    try{
                        CaseCloseResult = await bulkCaseClosure({CaseIds:activeCases,Comment:result});
                        if(CaseCloseResult === 0){
                            this.showToast('Success','Closed successfully','success');
                        }
                    }
                    catch(error){
                        this.showToast(`${CaseCloseResult} cases failed to update`,error.body.message,'error');
                    }
                }
                else{
                    this.showToast('Please select valid cases','All selected cases were already closed','error');
                }
                
            }
            else if(result === ''){
                this.showToast('Error',toastMsg,'error');
                this.handleCloseCases();
            }
            console.log(result);
        });
   }
   
   handleRowSelection(event){
        //const btn = event.targer.dataset.btn;
        const selectedRows = event.detail.selectedRows;
        //console.log(selectedRows);
        this.SelectedRows = selectedRows;
        //Need to re-check on here and template

   }

   handleRowSelectionAction(event){
        const btn = event.target.dataset.btnname;
        //console.log(btn);
        //console.log(this.SelectedRows.length);
        if(this.SelectedRows.length>0 && (btn!=null && btn!='')){
            console.log(btn);
            if(btn === 'close'){
                this.handleCloseCases();
            }
        }
        else{
            this.showToast('Select atleast one row',null,'error');
        }
   }
    
}