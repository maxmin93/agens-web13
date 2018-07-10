import { Injectable } from '@angular/core';
import { HttpClient, HttpHeaders } from '@angular/common/http';

import { IClientDto } from '../models/agens-dto-types'
import * as CONFIG from '../global.config';
import { Observable } from '../../node_modules/rxjs';

@Injectable({
  providedIn: 'root'
})
export class AgensDataService {

  private api: any = {
    core: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_CORE_API}`,
    mngr: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_MNGR_API}`,
    auth: `${window.location.protocol}//${window.location.host}/${CONFIG.AGENS_AUTH_API}`
  };

  public product:string = "Welcome to AgensBrowser";

  constructor (
    private _http: HttpClient    
  ) {
    if( CONFIG.DEV_MODE ){
      this.api = {
        core: 'http://127.0.0.1:8085/'+CONFIG.AGENS_CORE_API,
        mngr: 'http://127.0.0.1:8085/'+CONFIG.AGENS_MNGR_API,
        auth: 'http://127.0.0.1:8085/'+CONFIG.AGENS_AUTH_API,
      };
    }

    if( localStorage.getItem('agens-product') ) this.product = localStorage.getItem('agens-product');    
  }

  auth_connect():Observable<IClientDto>{
    let headers = new HttpHeaders({'Content-Type': 'application/json'}); 

    const url = `${this.api.auth}/connect`;
    return this._http.get<IClientDto>(url, {headers: headers});
  }

}
