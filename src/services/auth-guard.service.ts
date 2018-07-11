import { Injectable } from '@angular/core';
import { Router, CanActivate, ActivatedRouteSnapshot, RouterStateSnapshot } from '@angular/router';

import { AgensDataService } from './agens-data.service';
import { Observable, Subject } from 'rxjs';
import { map } from 'rxjs/operators';

@Injectable()
export class AuthGuardService implements CanActivate {

  constructor(
    private _router: Router,
    private _api: AgensDataService
  ) { 
  }

  canActivate(route: ActivatedRouteSnapshot, state: RouterStateSnapshot):Observable<boolean> {
    let isValid$ = this._api.isValid();
    isValid$.subscribe(x => {
      if( !x ){
        console.log(`isValid=${x}, move to "/login" by force`);
        this._router.navigate(['/login'], { queryParams: { returnUrl: state.url }});
      }
    });

    return this._api.auth_valid();
  }

}
