import { LightningElement, wire, track } from 'lwc';
import { CurrentPageReference } from 'lightning/navigation';
import GetRelatedFiles  from '@salesforce/apex/CaseManagementClass.GetRelatedFiles';
import DeleteFile  from '@salesforce/apex/CaseManagementClass.DeleteFile';
import SearchUser  from '@salesforce/apex/CaseManagementClass.SearchUser';
import AddNewWatchListUser  from '@salesforce/apex/CaseManagementClass.AddNewWatchListUser';
import FetchCaseWatchlist  from '@salesforce/apex/CaseManagementClass.FetchCaseWatchlist';
import postCaseComment  from '@salesforce/apex/CaseManagementClass.postCaseComment';
import FetchCaseComments  from '@salesforce/apex/CaseManagementClass.FetchCaseComments';
import deleteCaseComment  from '@salesforce/apex/CaseManagementClass.deleteCaseComment';
import { ShowToastEvent } from 'lightning/platformShowToastEvent';

export default class CaseDetails extends LightningElement {
    @track CaseNumber;
    @track relatedFiles;
    load = true;
    isNewSubscriber = false;
    currentSelectedTab = 'new';
    fields = ['Subject','CaseNumber','CreatedById','Description'];
    cols = [
        { label: 'Title', fieldName: 'Title' },
        { label: 'Owner', fieldName: 'OwnerName' },
        { label: 'Created', fieldName: 'CreatedDate',type: 'date' },
        { label: 'Download Link', fieldName: 'downloadUrl', type: 'url', typeAttributes: { label: 'Download', target: '_blank' } },
        { label: 'Delete?', type: 'button',typeAttributes:{label:'Delete',varient:'destructive',name:'delete'} },
        { label: 'Id', fieldName: 'Id', type: 'text', hideDefaultActions: true, fixedWidth: 1 },
    ]
    @track Disabled = true;
    @track watchListCurrentUsers;
    @track searchResultForWL;
    @track CaseCmtsList;
    @wire(CurrentPageReference)
    getStateParameters(currentPageRef) {
        if (currentPageRef && currentPageRef.state) {
            this.CaseNumber = currentPageRef.state.c__caseNumber;
        }
        console.log(this.CaseNumber);
    }

    /*connectedCallback(){
        this.fetchRelatedAttachments();
    }*/

    handleLoading(){
        this.load = !this.load;
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
        this.handleLoading();
    }

    showToast(title,msg,varient) {
        const event = new ShowToastEvent({
            title: title,
            message: msg!==null ? msg : '',
            variant: varient,
            mode: 'dismissable'
        });
        this.dispatchEvent(event);
    }

    handleTabSelection(event){
        const tab = event.target.value;
        //comments
        if(tab === 'comments'){
            this.getCaseComments();
        }
        //attachments
        else if(tab === 'attachment'){
            this.fetchRelatedAttachments();
        }
        //watchlist
        else if(tab === 'watchlist'){}
    }

    get acceptedFormats() {
        return ['.pdf', '.png'];
    }

    handleUploadFinished(event) {
        console.log(this.CaseNumber);
        const uploadedFiles = event.detail.files;
        this.InsertCaseComment(`Attachment [${uploadedFiles[0].name}] has been attached to case`);
    }

    fetchRelatedAttachments(){
        GetRelatedFiles({PId:this.CaseNumber})
            .then(result =>{
                console.log(result[0].CreatedBy.Name);
                const tempFiles = result.map(i=>({
                    ...i,downloadUrl : `/sfc/servlet.shepherd/version/download/${i.LatestPublishedVersionId}`, OwnerName : `${i.CreatedBy.Name}`
                }))
                this.relatedFiles = tempFiles;
            })
            .catch(error=>{
                console.log(error);
            })
    }

    handleRowAction(event){
        const btn = event.detail.action.name;
        const row = event.detail.row;
        console.log(row.Id);
        if(btn==='delete'){
            DeleteFile({FileId:row.Id})
            .then(result=>{
                this.showToast('Deleted','File deleted successfully','success');
            })
            .catch(error=>{
                this.showToast('Error',error.body.message,'error')
            });
        }
    }

    handleVerticalNavSelect(event){
        const selected = event.detail.name;
        if(selected === 'new'){
            this.isNewSubscriber = true;
        }
        else if(selected === 'view'){
            this.isNewSubscriber = false;
            FetchCaseWatchlist({CaseId:this.CaseNumber})
            .then(result=>{
                console.log(result.length)
                this.watchListCurrentUsers = result;
            })
            .catch(error=>{
                console.log(error);
            })
        }
        this.currentSelectedTab = selected;
    }

    handleSearchUserForWatchList(){
        const userName = this.template.querySelector('.searchterm-watchlist').value;
        if(userName.length>=3){
            SearchUser({UName:userName})
            .then(result=>{
                this.searchResultForWL = result;
            })
            .catch(error=>{
                console.log(error);
            })
        }
        else{
            this.showToast('error','Enter atleast 3 charecters','error');
        }
    }

    handleAddNewUserToWL(event){
        const userId = event.target.dataset.uid;
        const btn = event.target.dataset.btn;
        console.log(userId,this.CaseNumber);
        AddNewWatchListUser({CaseId:this.CaseNumber,newUserId:userId,action:btn})
        .then(result=>{
            console.log(result);
            if(btn==='remove'){
                this.watchListCurrentUsers = this.watchListCurrentUsers.filter(i=>i.Id!=userId);
            }
            btn === 'add' ? this.showToast('User Added','','success') : this.showToast('User removed from watchlist','','success')
        })
        .catch(error=>{
            console.log(error);
            this.showToast('error',error.body.message,'error');
        })
    }

    handleCasePost(){
        const cmtPost = this.template.querySelector('.inp-comment-post').value;
        console.log(cmtPost);
        this.InsertCaseComment(cmtPost);
    }

    InsertCaseComment(cmt){
        if(cmt.length>=3){
            postCaseComment({CaseId:this.CaseNumber,Comment:cmt})
            .then(result=>{
                console.log(result);
                this.showToast('Comment Added','','success');
                this.template.querySelector('.inp-comment-post').value = '';
                result = {...result,owner:result.CreatedBy.Name};
                this.CaseCmtsList = [result,...this.CaseCmtsList];
            })
            .catch(error=>{
                console.log(error);
                this.showToast('Error',error.body.message,'error');
            })
        }
        else{
            this.showToast('Please endter atleast 3 charecters','','error');
        }
    }

    getCaseComments(){
        FetchCaseComments({CaseId:this.CaseNumber})
        .then(result=>{
            const tempCmts = result.map(cmt=>({
                ...cmt,owner:cmt.CreatedBy.Name
            }))
            this.CaseCmtsList = tempCmts;
        })
    }

    removeCaseCmt(event){
        const CommnetId = event.target.dataset.cmtid;
        if(CommnetId){
            deleteCaseComment({CmtId:CommnetId})
            .then(result=>{
                console.log(result);
                this.showToast('Comment deleted','','success');
                this.CaseCmtsList = this.CaseCmtsList.filter(i=>i.Id!=CommnetId);
            })
            .catch(error=>{
                console.log(error);
                this.showToast('Error',error.body.message,'error');
            })
        }
    }
}