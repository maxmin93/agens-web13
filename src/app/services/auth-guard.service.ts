import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { HttpErrorResponse } from '@angular/common/http';

import { AgensDataService } from './agens-data.service';
import { of, Observable, Subject } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { IClientDto, IResponseDto } from '../models/agens-response-types';

import * as CONFIG from '../app.config';

@Injectable()
export class AuthGuardService implements CanActivate {

  constructor(
    private _router: Router,
    private _api: AgensDataService
  ) { 
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot):Observable<boolean> {
    let isValid$:Observable<boolean> = this._api.auth_valid();
    isValid$.subscribe(x => {
      if( !x ){
        console.log(`isValid=${x}, move to "/login" by force`);
        this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
      }
    },
    err => {
      this._api.setResponses(<IResponseDto>{
        group: 'auth.connect',
        state: err.statusText,
        message: (err instanceof HttpErrorResponse) ? err.error.message : err.message
      });

      setTimeout(() => {
        // login 페이지로 이동
        this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
      }, 10);
    });
    
    return isValid$.pipe( catchError(err => of(false)) );    
  }

}
