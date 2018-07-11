import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { Observable, Subject, BehaviorSubject } from 'rxjs';
import { map } from 'rxjs/operators';

import { IClientDto, ISchemaDto, IResponseDto } from '../models/agens-dto-types'
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

  private lastResponse = new Subject<IResponseDto>();
  private isValid$ = new Subject<boolean>(); // new BehaviorSubject<boolean>(false);

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

  public getSSID():string {
    console.log( 'getSSID()', this.client );
    return (this.client !== null) ? this.client.ssid : 'None';
  }
  public getProductInfo():any {
    return { 
        name: (this.client !== null) ? this.client.product_name : 'AgensBrowser web'
        , version: (this.client !== null) ? this.client.product_version : ''
      };
  }
  public getClient():IClientDto {
    return this.client;
  }

  public isValid():Observable<boolean> {
    return this.isValid$.asObservable();
  }

  public setResponses(dto:IResponseDto) {
    if( dto ) this.lastResponse.next(dto);
    else this.lastResponse.next();
  }
  public getResponse():Observable<IResponseDto> {
    return this.lastResponse.asObservable();
  }


  /////////////////////////////////////////////////

  private createAuthorizationHeader():HttpHeaders {
    return new HttpHeaders({ 'Content-Type': 'application/json', 'Authorization': this.getSSID() }); 
  }

  auth_valid() {
    const url = `${this.api.auth}/valid`;
    console.log( `[${this.getSSID()}] url => ${url}`);
    this._http.get<IClientDto>(url, {headers: this.createAuthorizationHeader()})
        .subscribe({
          next: dto => {
            this.setResponses(<IResponseDto>dto);
            console.log( 'auth_valid::subscribe', dto );

            if(dto.valid === true) this.isValid$.next(true);
            else this.isValid$.next(false);
          },
          error: err => {
            this.setResponses(<IResponseDto>{
              group: 'auth.valid',
              state: CONFIG.StateType.ERROR,
              message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
            });

            this.client = null;
            this.isValid$.next(false);
          }
        });

    return this.isValid$.asObservable();
  }

  auth_connect():Observable<boolean> {
    const url = `${this.api.auth}/connect`;
    // console.log( `[${this.getSSID()}] url => ${url}`);
    return this._http.get<IClientDto>(url, {headers: new HttpHeaders({'Content-Type': 'application/json'})})
        .pipe( map(dto => {
          this.setResponses(<IResponseDto>dto);
          this.client = dto;

          if(dto.valid === true) return true;
          else return false;
        }) );
  }

}
