import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { MatSnackBar } from '@angular/material';

import { AgensDataService } from '../../services/agens-data.service';
import { IResponseDto } from '../../models/agens-dto-types';

import { Angulartics2 } from 'angulartics2';
import { Observable } from 'rxjs';

import * as CONFIG from '../../global.config';

@Component({
  selector: 'app-login',
  templateUrl: './login.component.html',
  styleUrls: ['./login.component.scss']
})
export class LoginComponent implements OnInit {

  private waitTime: number = 4000;
  private returnUrl: string;

  constructor(
    private _route: ActivatedRoute,
    private _router: Router,
    private _angulartics2: Angulartics2,
    private _api: AgensDataService,
    public _snackBar: MatSnackBar
  ) { 
  }

  ngOnInit(){
    // initialize ssid
    localStorage.removeItem('agens-ssid');
    // get return url from route parameters or default to '/'
    this.returnUrl = this._route.snapshot.queryParams['returnUrl'] || '/';

    this.login();
  }

  openSnackBar() {
    this._api.getResponse().subscribe(
      x => this._snackBar.open(x.message, x.state, { duration: 3000, })
    );    
  }

  login() {
    let connect$:Observable<boolean> = this._api.auth_connect();

    connect$.subscribe(
        x => { 
          if( x ) this.openSnackBar();
        },
        err => {
          this._api.setResponses(<IResponseDto>{
            group: 'auth.valid',
            state: CONFIG.StateType.ERROR,
            message: !(err.error instanceof Error) ? err.error.message : JSON.stringify(err)
          });
          this.openSnackBar();
        },
        () => {
          // after a few minitues, start navigation
          setTimeout(() => {
            console.log(`wait ${this.waitTime/1000} seconds..`);            
            // returnUrl 로 이동
            this._router.navigate([this.returnUrl]);
          }, this.waitTime);          
        });
  }


}
