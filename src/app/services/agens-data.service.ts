import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';
import * as _ from 'lodash';

import { IClientDto, ISchemaDto, IResponseDto } from '../models/agens-response-types'
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
  private schema:ISchemaDto = null;      // graph, labels, meta
  
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
  getCurrentMenu$():Observable<string> {
    return this.currentMenu$.asObservable();
  }
  getProductTitle$():Observable<string> {
    return this.productTitle$.asObservable();
  }

  setResponses(dto:IResponseDto) {
    if( dto ) this.lastResponse$.next(dto);
    else this.lastResponse$.next();
  }
  getResponse():Observable<IResponseDto> {
    return this.lastResponse$.asObservable();
  }

  /////////////////////////////////////////////////

  changeMenu(menu: string) {
    this.currentMenu$.next(menu);
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
        });0

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

}
