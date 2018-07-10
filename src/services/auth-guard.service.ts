import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';

import { AgensApiService } from './agens-api.service';

import { IClientDto } from '../models/agens-dto-types';

@Injectable()
export class AuthGuardService implements CanActivate {

  constructor(
    private _http: HttpClient,
    private _router: Router,
    private _agens: AgensApiService
  ) { 
  }

  private createAuthorizationHeader():HttpHeaders {
    let ssid:string = localStorage.getItem('agens-ssid');
    return new HttpHeaders({'Content-Type': 'application/json', 'Authorization':ssid}); 
  }
  
  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot){
    let ssid:string = localStorage.getItem('agens-ssid');
    if( !ssid ){
      this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
      return Promise.resolve(false);
    } 

    const url = `${this._agens.api.AUTH}/valid`;
    // let params:HttpParams = new HttpParams().set('ssid', ssid);
    return this._http.get<IClientDto>(url, { headers: this.createAuthorizationHeader() })
        .toPromise()
        .then(data => { 
          // console.log(`canActivate: ssid=${data.ssid}, valid=${data.valid}`);
          // 적합
          if( data.valid === true ) {
            this._agens.client = data;
            return true;
          }
          // 부적합 ssid인 경우, 삭제하고 로그인 페이지로 이동
          localStorage.removeItem('agens-ssid');
          this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
          return false;
        },
        err => {
          // if (!(err.error instanceof Error)) {
          //   console.log(`[${err.error.state}] ${err.error.message}\n${err.error._link}`);
          // }
          // else console.log(`canActivate: error=${err.error}`);
          this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
          return false;
        });
  }

}
