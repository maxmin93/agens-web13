import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders, HttpParams } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject, Subscription } from 'rxjs';
import { map, filter, concatAll } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto, ILabelDto, IResultDto } from '../models/agens-response-types';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty, IRecord, IColumn, IRow } from '../models/agens-data-types';
import { ILogs, IProject } from '../models/agens-manager-types';

import * as CONFIG from '../global.config';

@Injectable({
  providedIn: 'root'
})
export class AgensDataService {

  private api: any = {
    core: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_CORE_API}`,
    mngr: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_MNGR_API}`,
    auth: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_AUTH_API}`
  };

  private lastResponse$ = new Subject<IResponseDto>();
  private isValid$ = new Subject<boolean>();

  private productTitle$ = new BehaviorSubject<string>('Bitnine');
  private currentMenu$ = new BehaviorSubject<string>("login");

  private client:IClientDto = null;      // ssid, user_name, user_ip, timestamp, valid
  private schema:any = {
    info$: new Subject<ISchemaDto>(),
    graph$: new Subject<IGraph>(),
    labels$: new Subject<ILabel>(),
    nodes$: new Subject<INode>(),
    edges$: new Subject<IEdge>()
  };
  private result:any = {
    info$: new Subject<IResultDto>(),
    graph$: new Subject<IGraph>(),
    labels$: new Subject<ILabel>(),
    nodes$: new Subject<INode>(),
    edges$: new Subject<IEdge>(),
    record$: new Subject<IRecord>(),
    columns$: new Subject<IColumn>(),
    rows$: new Subject<IRow>(),
  };
  
  constructor (
    private _http: HttpClient,
    public _snackBar: MatSnackBar
  ) {
    if( CONFIG.DEV_MODE ){
      this.api = {
        core: 'http://127.0.0.1:8085/'+CONFIG.AGENS_CORE_API,
        mngr: 'http://127.0.0.1:8085/'+CONFIG.AGENS_MNGR_API,
        auth: 'http://127.0.0.1:8085/'+CONFIG.AGENS_AUTH_API,
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
  getIsValid$():Observable<boolean> {
    return this.isValid$.asObservable();
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

  getSchemaSubjects():any {
    return this.schema;
  }
  getResultSubjects():any {
    return this.result;
  }

  /////////////////////////////////////////////////

  private createAuthorizationHeader():HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': this.getSSID() }); 
  }

  auth_valid() {
    const url = `${this.api.auth}/valid`;
    this._http.get<IClientDto>(url, {headers: this.createAuthorizationHeader()})
        .subscribe({
          next: dto => {
            this.setResponses(<IResponseDto>dto);
            if(dto.valid === true){
              this.saveClient(dto);
              this.isValid$.next(true);
            }
            else this.isValid$.next(false);
          },
          error: err => {
            this.setResponses(<IResponseDto>{
              group: 'auth.valid',
              state: CONFIG.StateType.ERROR,
              message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
            });
            this.isValid$.next(false);
          }
        });

    return this.isValid$.asObservable();
  }

  auth_connect():Observable<boolean> {
    const url = `${this.api.auth}/connect`;
    console.log( `[${this.getSSID()}] auth_connect => ${url}`);
    return this._http.get<IClientDto>(url, {headers: new HttpHeaders({'Content-Type': 'application/json'})})
        .pipe( map(dto => {
          this.setResponses(<IResponseDto>dto);
          if( dto.valid === true ){
            this.saveClient(dto);
            this.isValid$.next(true);
            localStorage.setItem(CONFIG.USER_KEY, dto.ssid);
            return true;
          } 
          else return false;
        }) );
  }

  private saveClient(dto:IClientDto){   
    this.client = dto;
    this.productTitle$.next( dto.product_name + ' ' + dto.product_version );
  }

  core_schema():Subscription {
    const url = `${this.api.core}/schema`;
    return this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( concatAll(), filter(x => x.hasOwnProperty('group')) )
        .subscribe({
          next: x => {
            this.setResponses(<IResponseDto>x);
            switch( x['group'] ){
              case 'schema':  this.schema.info$.next(x); break;
              case 'graph':   this.schema.graph$.next(x); break;
              case 'labels':  this.schema.labels$.next(x); break;
              case 'nodes':   this.schema.nodes$.next(x); break;
              case 'edges':   this.schema.edges$.next(x); break;
            }
          },
          error: err => {
            this.setResponses(<IResponseDto>{
              group: 'core.schema',
              state: CONFIG.StateType.ERROR,
              message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
            });
          },
          complete: () => {
            this.schema.info$.complete();
            this.schema.graph$.complete();
            this.schema.labels$.complete();
            this.schema.nodes$.complete();
            this.schema.edges$.complete();
          }
        });
  }

  core_query(sql:string){
    const url = `${this.api.core}/query`;
    // **NOTE: encodeURIComponent( sql ) 처리
    // (SQL문의 '+','%','&','/' 등의 특수문자 변환)
    let params:HttpParams = new HttpParams().set('sql', encodeURIComponent( sql ) );

    return this._http.get<IResultDto>(url, {params: params, headers: this.createAuthorizationHeader()})
      .pipe( concatAll(), filter(x => x.hasOwnProperty('group')) )
      .subscribe({
        next: x => {
          this.setResponses(<IResponseDto>x);
          switch( x['group'] ){
            case 'result':  this.result.info$.next(x); break;
            case 'graph':   this.result.graph$.next(x); break;
            case 'labels':  this.result.labels$.next(x); break;
            case 'nodes':   this.result.nodes$.next(x); break;
            case 'edges':   this.result.edges$.next(x); break;
            case 'record':   this.result.record$.next(x); break;
            case 'columns':  this.result.columns$.next(x); break;
            case 'rows':   this.result.rows$.next(x); break;
          }
        },
        error: err => {
          this.setResponses(<IResponseDto>{
            group: 'core.query',
            state: CONFIG.StateType.ERROR,
            message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
          });
        },
        complete: () => {
          this.result.info$.complete();
          this.result.graph$.complete();
          this.result.labels$.complete();
          this.result.nodes$.complete();
          this.result.edges$.complete();
          this.result.record$.complete();
          this.result.columns$.complete();
          this.result.rows$.complete();
        }
      });
  }

  // call API: expand from selected Node
  core_query_expand( sourceId: string, sourceLabel:string, targetLabel:string ){
    //
    // ** NOTE: 확장 쿼리 (source 라벨은 필요 없음)
    //     expandTo SQL:
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

    return this._http.get<IResultDto>(url, {params: params, headers: this.createAuthorizationHeader()});
  }

  core_command_drop_label(target:ILabel):Observable<ILabelDto> {
    const url = `${this.api.core}/command`;

    let params:HttpParams = new HttpParams();
    params = params.append('type', CONFIG.RequestType.DROP);                   // DROP
    if( target.type === 'NODE' ) params = params.append('command', 'vlabel');  // if NODE
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
    if( target.type === 'NODE' ) params = params.append('command', 'vlabel');  // if NODE
    else params = params.append('command', 'elabel');                          // else EDGE
    params = params.append('target', target.name);                             // target
    params = params.append('options', target.desc);                            // label.desc
    
    console.log( `core_command_create_label => ${params.toString()}`);
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

}
