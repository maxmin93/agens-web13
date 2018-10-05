import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams, HttpRequest } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject, Subscription, empty } from 'rxjs';
import { map, filter, concatAll, share } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto, ILabelDto, IResultDto, IGraphDto, IDoubleListDto } from '../models/agens-response-types';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IRecord, IColumn, IRow } from '../models/agens-data-types';
import { ILogs, IProject } from '../models/agens-manager-types';

import * as CONFIG from '../app.config';

@Injectable({
  providedIn: 'root'
})
export class AgensDataService {

  private api: any = {
    core: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_CORE_API}`,
    mngr: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_MNGR_API}`,
    auth: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_AUTH_API}`,
    grph: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_GRPH_API}`,
    file: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_FILE_API}`,
  };

  private lastResponse$ = new Subject<IResponseDto>();

  private productTitle$ = new BehaviorSubject<string>('Bitnine');
  private currentMenu$ = new BehaviorSubject<string>("login");

  private client:IClientDto = null;      // ssid, user_name, user_ip, timestamp, valid
  
  constructor (
    private _http: HttpClient,
    public _snackBar: MatSnackBar
  ) {
    if( CONFIG.DEV_MODE ){
      this.api = {
        core: 'http://127.0.0.1:8085/'+CONFIG.AGENS_CORE_API,
        mngr: 'http://127.0.0.1:8085/'+CONFIG.AGENS_MNGR_API,
        auth: 'http://127.0.0.1:8085/'+CONFIG.AGENS_AUTH_API,
        grph: 'http://127.0.0.1:8085/'+CONFIG.AGENS_GRPH_API,
        file: 'http://127.0.0.1:8085/'+CONFIG.AGENS_FILE_API,
      };
    }

    this.lastResponse$.subscribe(
      x => this._snackBar.open(x.message, x.state, { duration: 4000, })
    );
  }

  openSnackBar() {
    this.getResponse().subscribe(
      x => this._snackBar.open(x.message, x.state, { duration: 4000, })
    );
  }

  /////////////////////////////////////////////////

  changeMenu(menu: string) {
    this.currentMenu$.next(menu);
  }
  getCurrentMenu$():Observable<string> {
    return this.currentMenu$.asObservable();
  }
  getProductTitle$():Observable<string> {
    return this.productTitle$.asObservable();
  }

  /////////////////////////////////////////////////

  getSSID():string {
    let ssid = localStorage.getItem(CONFIG.USER_KEY);
    return _.isNil(ssid) ? 'Nil' : ssid;
  }
  getClient():IClientDto {
    return this.client;
  }

  setResponses(dto:IResponseDto) {
    if( dto && dto.hasOwnProperty('state') && dto.hasOwnProperty('message') ) 
      this.lastResponse$.next(dto);
    // else this.lastResponse$.next();
  }
  getResponse():Observable<IResponseDto> {
    return this.lastResponse$.asObservable();
  }

  /////////////////////////////////////////////////

  // getSchemaSubjects():any {
  //   return this.schema;
  // }
  // getResultSubjects():any {
  //   return this.result;
  // }
  // getTgraphSubjects():any {
  //   return this.tgraph;
  // }

  /////////////////////////////////////////////////

  private createAuthorizationHeader():HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': this.getSSID() }); 
  }

  auth_valid():Observable<boolean> {
    const url = `${this.api.auth}/valid`;
    return this._http.get<IClientDto>(url, {headers: this.createAuthorizationHeader()})
        .pipe( map(dto => dto.valid), share() );
  }

  auth_connect():Observable<boolean> {
    const url = `${this.api.auth}/connect`;
    console.log( `[${this.getSSID()}] auth_connect => ${url}`);
    return this._http.get<IClientDto>(url, {headers: new HttpHeaders({'Content-Type': 'application/json'})})
        .pipe( map(dto => {
          this.setResponses(<IResponseDto>dto);
          if( dto.valid === true ){
            this.saveClient(dto);
            return true;
          } 
          return false;
        }) );
  }

  private saveClient(dto:IClientDto){   
    this.client = dto;
    this.productTitle$.next( dto.product_name + ' ' + dto.product_version );
    localStorage.setItem(CONFIG.USER_KEY, dto.ssid);
  }

  core_schema():Observable<any> {
    const url = `${this.api.core}/schema`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  core_query(gid:number, sql:string):Observable<any> {
    const url = `${this.api.core}/query`;
    // **NOTE: encodeURIComponent( sql ) 처리
    //         (SQL문의 '+','%','&','/' 등의 특수문자 변환)
    let params:HttpParams = new HttpParams().set('sql', encodeURIComponent( sql ) );
    params = params.append('gid', gid+''); 

    return this._http.get<any>(url, {params: params, headers: this.createAuthorizationHeader()})
      .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  // call API: expand from selected Node
  core_query_expand( sourceId: string, sourceLabel:string, targetLabel:string ):Observable<any> {
    //
    // ** NOTE: 확장 쿼리
    //     ex) match (s:"customer")-[e]-(v:"order") where id(s) = '11.1' return e, v limit 5;
    // ** NOTE: 확장 노드 사이즈 = 20
    //     20개만 확장 (너무 많아도 곤란) <== 단지 어떤 데이터가 더 있는지 보고 싶은 용도임!
    //
    let sql = `match (s:"${sourceLabel}")-[e]-(v:"${targetLabel}") where to_jsonb(id(s)) = '${sourceId}' return e, v limit 20;`;
    if( this.client.product_version <= '1.2' ){
      sql = `match (s:"${sourceLabel}")-[e]-(v:"${targetLabel}") where id(s) = '${sourceId}' return e, v limit 20;`;
    }

    const url = `${this.api.core}/query`;
    let params:HttpParams = new HttpParams();
    params = params.append('sql', encodeURIComponent( sql ) );
    params = params.append('options', 'loggingOff');

    return this._http.get<any>(url, {params: params, headers: this.createAuthorizationHeader()})
      .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  core_command_drop_label(target:ILabel):Observable<ILabelDto> {
    const url = `${this.api.core}/command`;

    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.DROP);                   // DROP
    if( target.type === 'nodes' ) params = params.append('command', 'vlabel');  // if NODE
    else params = params.append('command', 'elabel');                          // else EDGE
    params = params.append('target', target.name);                             // target
    params = params.append('options', target.desc);                            // label.desc
    
    console.log( `core_command_drop_label => ${params.toString()}`);
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_command_create_label(target:ILabel):Observable<ILabelDto> {
    const url = `${this.api.core}/command`;

    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.CREATE);                 // CREATE
    if( target.type === 'nodes' ) params = params.append('command', 'vlabel');  // if NODE
    else params = params.append('command', 'elabel');                          // else EDGE
    params = params.append('target', target.name);                             // target
    params = params.append('options', target.desc);                            // label.desc
    
    console.log( `core_command_create_label => ${params.toString()}`);
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_create_label(type:string, name:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.CREATE);           // CREATE
    if( type === 'nodes' ) params = params.append('command', 'vlabel');  // VLABEL
    else params = params.append('command', 'elabel');                    // or ELABEL
    params = params.append('target', name);                              // <name>
    
    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_drop_label(type:string, name:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.DROP);              // DROP
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', name);                               // <name>
    
    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_rename_label(type:string, oldName:string, newName:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.RENAME);            // ALTER ~ RENAME
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', oldName);                            // <oldName>
    params = params.append('options', newName);                           // <newName>
    
    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_comment_label(type:string, name:string, desc:string):Observable<ILabelDto> {
    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.COMMENT);           // COMMENT ON
    if( type === 'nodes' ) params = params.append('command', 'vlabel');   // VLABEL
    else params = params.append('command', 'elabel');                     // or ELABEL
    params = params.append('target', name);                               // <name>
    params = params.append('options', desc);                              // <desc>
    
    const url = `${this.api.core}/command`;
    return this._http.get<ILabelDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  mngr_project_detail(id):Observable<IProject> {
    const url = `${this.api.mngr}/projects/${id}`;
    return this._http.get<IProject>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_projects_list():Observable<IProject> {
    const url = `${this.api.mngr}/projects`;
    return this._http.get<IProject>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_project_save(project:IProject):Observable<IProject> {
    const url = `${this.api.mngr}/projects/save`;
    return this._http.post<IProject>(url, JSON.stringify(project), { headers: this.createAuthorizationHeader() });
  }

  mngr_project_delete(id):Observable<IProject> {
    const url = `${this.api.mngr}/projects/delete/${id}`;
    return this._http.get<IProject>(url, {headers: this.createAuthorizationHeader()});
  }

  mngr_history():Observable<ILogs> {
    const url = `${this.api.mngr}/logs`;
    return this._http.get<ILogs>(url, {headers: this.createAuthorizationHeader()});
  }

  ////////////////////////////////////////////////

  grph_graph(gid:number):Observable<any> {
    const url = `${this.api.grph}/${gid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }  

  grph_schema(gid:number):Observable<any> {
    const url = `${this.api.grph}/schema/${gid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }  

  grph_filterNgroupBy(gid:number, params:any):Observable<any> {
    if( params['filters'].length == 0 && params['groups'].length == 0 ) return empty();
    // console.log( 'grph_filterNgroupBy:', params);

    const url = `${this.api.grph}/filterby-groupby/${gid}`;
    return this._http.post<any>(url, params, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  grph_update(gid:number, oper:string, data:IGraphDto):Observable<IResponseDto> {    
    const url = `${this.api.grph}/update/${gid}/${oper}`;   // oper : 'delete' | 'upsert'
    return this._http.post<any>(url, data, {headers: this.createAuthorizationHeader()});
  }

  grph_groupBy(gid:number, list:any[]):Observable<any> {
    if( list.length == 0 ) return empty();
    let label:string = list[0]['label'];
    let props:string = list[0]['props'];
    const url = `${this.api.grph}/groupby/${gid}?label=${label}&props=${props}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')), share() );
  }

  graph_findShortestPath(gid:number, sid:string, eid:string):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findspath/${gid}`;
    let params:HttpParams = new HttpParams();
    params = params.append('sid', sid);   // start node id
    params = params.append('eid', eid);   // end node id

    return this._http.get<IDoubleListDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  graph_findConnectedGroup(gid:number):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findcgroup/${gid}`;
    return this._http.get<IDoubleListDto>(url, {headers: this.createAuthorizationHeader()});
  }

  graph_findCycles(gid:number):Observable<IDoubleListDto> {
    const url = `${this.api.grph}/findcycles/${gid}`;
    return this._http.get<IDoubleListDto>(url, {headers: this.createAuthorizationHeader()});
  }

  //////////////////////////////////////////////////////

  core_pglang_list():Observable<any> {
    const url = `${this.api.core}/pglang/list`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_list():Observable<any> {
    const url = `${this.api.core}/pgproc/list`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_detail(pid:string):Observable<any> {
    const url = `${this.api.core}/pgproc/${pid}`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_save(proc:any):Observable<IResponseDto> {
    const url = `${this.api.core}/pgproc/save`;
    return this._http.post<any>(url, proc, {headers: this.createAuthorizationHeader()});
  }

  core_pgproc_delete(proc:any):Observable<IResponseDto> {
    const url = `${this.api.core}/pgproc/delete`;
    return this._http.post<any>(url, proc, {headers: this.createAuthorizationHeader()});
  }

  //////////////////////////////////////////////////////
  // **참고
  // https://www.codingforentrepreneurs.com/blog/file-upload-with-angular/
  // https://malcoded.com/posts/angular-file-upload-component-with-express

  // graphson type: json, "application/json"
  // graphml type: xml, "text/xml"
  // gryo type: kryo, ""                      <== kryo는 내부에서만 쓰고 json, xml 만 사용

  fileUpload(fileItem:File, extraData?:object):any{
    const url = `${this.api.file}/upload`;
    const formData: FormData = new FormData();

    formData.append('file', fileItem, fileItem.name);
    if (extraData) {
      for(let key in extraData){
        // iterate and set other form data
        formData.append(key, extraData[key])
      }
    }

    const req = new HttpRequest('POST', url, formData, {
      // **NOTE: 이거 필요 없음! 오류만 발생함 ==> 'Content-Type': 'multipart/form-data'
      headers: new HttpHeaders({ 'Authorization': this.getSSID() }),
      reportProgress: true // for progress data
    });
    return this._http.request(req);
  }

  fileDownload(url): Observable<any>{
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()});
  }

  importFile(fileItem:File, extraData?:object):any{
    const url = `${this.api.file}/import`;
    const formData: FormData = new FormData();

    formData.append('file', fileItem, fileItem.name);
    if (extraData) {
      for(let key in extraData){
        // iterate and set other form data
        formData.append(key, extraData[key])
      }
    }

    const req = new HttpRequest('POST', url, formData, {
      // **NOTE: 이거 필요 없음! 오류만 발생함 ==> 'Content-Type': 'multipart/form-data'
      headers: new HttpHeaders({ 'Authorization': this.getSSID() }),
      reportProgress: true // for progress data
    });
    return this._http.request(req);
  }
  
}
