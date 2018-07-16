import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map, filter } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto } from '../models/agens-response-types';
import { IDatasource, IGraph, ILabel, IElement, INode, IEdge, IProperty } from '../models/agens-data-types';

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
    let ssid = localStorage.getItem('agens-ssid');
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
            localStorage.setItem('agens-ssid', dto.ssid);
            return true;
          } 
          else return false;
        }) );
  }

  private saveClient(dto:IClientDto){   
    this.client = dto;
    this.productTitle$.next( dto.product_name + ' ' + dto.product_version );
  }

  core_schema():any {
    const url = `${this.api.core}/schema`;
    this._http.get<any>(url, {headers: this.createAuthorizationHeader()})
        .pipe( filter(x => x.group) )
        .subscribe({
          next: dto => {
            this.setResponses(<IResponseDto>dto);
            switch( dto.group ){
              case 'schema':  this.schema.info$.next(); break;
              case 'graph':   this.schema.graph$.next(); break;
              case 'labels':  this.schema.labels$.next(); break;
              case 'nodes':   this.schema.nodes$.next(); break;
              case 'edges':   this.schema.edges$.next(); break;
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

    return this.schema;
  }

}
