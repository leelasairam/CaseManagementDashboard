public class CaseManagementClass {

    @AuraEnabled(cacheable=true)
    public static map<String,Object> GetUserAssignedCases(String q,String WhereCondition, Integer OffSet1){
        Map<String, Object> response = new Map<String, Object>();
        //Id UserId = UserInfo.getUserId();
        list<Case>UserCases = database.query(q);
        
        if(OffSet1 == 0){
            String countQuery1 = 'SELECT count() FROM Case '+WhereCondition;
            Integer CountCases = (Integer) Database.countQuery(countQuery1);
            response.put('count',CountCases);
        }
        else{
            response.put('count',null);
        }
        response.put('records',UserCases);
        return response;
        //return UserCases;
    }
    
    /*@AuraEnabled(cacheable=true)
    public static Integer CountCases(String FilterQuery){
       String q = 'SELECT count() FROM Case '+FilterQuery;
       list<Case>Cases = database.query(q); 
       return Cases.size();
    }*/
    
    @AuraEnabled
    public static void CreateCaseFilter(String owner,String q, String filters,String FName,String logic,String FId){
        if((owner!= null || owner != '') && (q!=null || q!='') && (filters!=null || filters!='')){
            Case_Filters__c CaseFilter = new Case_Filters__c();
            CaseFilter.OwnerId = owner;
            CaseFilter.Filter__c = filters;
            CaseFilter.Query__c = q;
            CaseFilter.Custom_Filter__c = logic;
            if(FId == null){
               list<Case_Filters__c>filtersByName = [SELECT Id FROM Case_Filters__c WHERE Name = :FName AND OwnerId = :owner];
                if(filtersByName.isEmpty()){
                    CaseFilter.Name = FName;
               		insert CaseFilter; 
                }
                else{
                    throw new DmlException('There is already a filter with this Name');
                }
            }
            else{
               CaseFilter.Id = FId;
               update CaseFilter;
            }
        }
    }
    
    @AuraEnabled
    public static void DeleteCaseFilter(String FId){
        if(FId != null && FId != ''){
            Case_Filters__c CaseFilter = new Case_Filters__c();
            CaseFilter.Id = FId;
            try{
                delete CaseFilter;
            }
            catch(Exception e){
                throw new AuraHandledException(e.getMessage());
             }
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static list<Case_Filters__c> GetUserCaseFilters(String UID){
        if(UID != null){
            return [SELECT Id,Name,Query__c,Filter__c,Custom_Filter__c FROM Case_Filters__c WHERE OwnerId=:UID Order By CreatedDate DESC];
        }
        else{
            return null;
        }
    }
    
    @AuraEnabled
    public static Integer bulkCaseClosure(list<String>CaseIds,String Comment){
        list<Case>ProcessCaseClouser = new list<Case>();
        Integer FailedCaseNumbers = 0;
        if(!CaseIds.isEmpty()){
            for(String caseId : CaseIds){
                Case c = new Case();
                c.Id = caseId;
                c.Status = 'Closed';
                c.Comments = Comment;
                ProcessCaseClouser.add(c);
            }
            if(!ProcessCaseClouser.isEmpty()){
                try{
                    Database.SaveResult[] srList = Database.update(ProcessCaseClouser, false);
                    for(Database.SaveResult sr : srList){
                        if(!sr.isSuccess()){
                            FailedCaseNumbers+=1;
                        }
                    }
                }
                catch(Exception e){
                    throw new AuraHandledException(e.getMessage());
                }
            }
        }
        return FailedCaseNumbers;
    }
    
    @AuraEnabled(cacheable=true)
    public static list<ContentDocument>GetRelatedFiles(String PId){
        if(PId != null && PId != ''){
            list<Id>ContentIds = new list<Id>();
            list<ContentDocumentLink>CDL = [SELECT ContentDocumentId FROM ContentDocumentLink WHERE LinkedEntityId = :PId];
            for(ContentDocumentLink i : CDL){
                ContentIds.add(i.ContentDocumentId);
            }
            return [SELECT Id,Title,FileExtension,LatestPublishedVersionId,CreatedDate,CreatedBy.Name FROM ContentDocument WHERE Id IN :ContentIds];
        }
        else{
            return null;
        }
    }
    @AuraEnabled
    public static void DeleteFile(String FileId){
        ContentDocument cd = new ContentDocument();
        cd.Id = FileId;
        try{
             delete cd;   
        }
        catch(Exception e){
            throw new AuraHandledException(e.getMessage());
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static list<User>FetchCaseWatchlist(String CaseId){
        Case cs = [SELECT Id,Case_Watchlist__c FROM Case WHERE Id =:CaseId];
        list<String>UserIds = new list<String>();
        list<user>returnUsers = new list<user>();
        if(cs.Case_Watchlist__c != null && cs.Case_Watchlist__c!=''){
            list<string>tempWL = cs.Case_Watchlist__c.split(',');
            for(String i : tempWL){
                UserIds.add(i);
            }
        }
        if(!UserIds.IsEmpty()){
            returnUsers = [SELECT Id,Name,Email FROM User WHERE Id IN :UserIds AND IsActive = true];
        }
        return returnUsers;
    }
    
    @AuraEnabled
    public static void AddNewWatchListUser(String CaseId, String newUserId,String action) {
        if (newUserId != null && newUserId != '') {
            Case cs = [SELECT Id, Case_Watchlist__c FROM Case WHERE Id = :CaseId];
            if(action == 'add'){
                if (cs.Case_Watchlist__c == null || cs.Case_Watchlist__c == '') {
                    cs.Case_Watchlist__c = newUserId + ',';
                    update cs;
                } 
                else if (!cs.Case_Watchlist__c.contains(newUserId)) {
                    cs.Case_Watchlist__c += newUserId + ',';
                    update cs;
                } 
                else {
                    throw new DmlException('This user is already available in WatchList. Please refresh if it does not appear.');
                }
            }
            else if(action == 'remove'){
                if(cs.Case_Watchlist__c != null && cs.Case_Watchlist__c != ''){
                    list<string>tempWL = cs.Case_Watchlist__c.split(',');
                    String newWL = '';
                    for(String i : tempWL){
                        if(i != newUserId){
                            newWL += i+',';
                        }
                    }
                    cs.Case_Watchlist__c = newWL;
                    update cs;
                }
            }
        }
    }

    
    @AuraEnabled(cacheable=true)
    public static list<user>SearchUser(String UName){
        if(UName != null && UName != ''){
            return [SELECT Id,Name,Email FROM User WHERE Name LIKE :('%' + UName + '%') AND IsActive=true];
        }
        else{
            return null;
        }
    }
    
    @AuraEnabled
    public static CaseComment postCaseComment(String CaseId,String Comment){
        if(CaseId != null && CaseId != '' && Comment!=null && Comment!=''){
            CaseComment cm = new CaseComment();
            cm.ParentId = CaseId;
            cm.CommentBody = Comment;
            try{
                insert cm;
                return [SELECT Id,ParentId,CommentBody,CreatedDate,CreatedBy.Name FROM CaseComment WHERE Id = :cm.Id];
            }
            catch(Exception e){
            	throw new AuraHandledException(e.getMessage());
        	}
        }
        else{
            return null;
        }
    }
    
    @AuraEnabled(cacheable=true)
    public static list<CaseComment> FetchCaseComments(String CaseId){
        if(CaseId!=null && CaseId!=''){
            return [SELECT Id,ParentId,CommentBody,CreatedDate,CreatedBy.Name FROM CaseComment WHERE ParentId =: CaseId Order By CreatedDate DESC];
        }
        else{
            return null;
        }
    }
    
    @AuraEnabled
    public static void deleteCaseComment(String CmtId){
        if(CmtId != null && CmtId != ''){
            CaseComment cm = new CaseComment();
        	cm.Id = CmtId;
            try{
                delete cm;
            }
            catch(Exception e){
            	throw new AuraHandledException(e.getMessage());
        	}
        }
    }
}