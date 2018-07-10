import { Component, OnInit } from '@angular/core';
import { Router, ActivatedRoute } from '@angular/router';

import { HttpClient, HttpHeaders } from '@angular/common/http';
import { MatSnackBar } from '@angular/material';

import { AgensDataService } from '../../services/agens-data.service';
import { IClientDto, IResponseDto } from '../../models/agens-dto-types';

import { Angulartics2 } from 'angulartics2';
import { Observable } from '../../../node_modules/rxjs';

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
    private _data: AgensDataService,
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

  openSnackBar(message: string, action: string) {
    this._snackBar.open(message, action, { duration: 3000, });
  }

  login() {
    let connect$:Observable<IClientDto> = this._data.auth_connect();

    return connect$.subscribe(
        data => {
          console.log(`login: ssid=${data.ssid}, valid=${data.valid}`);  

          // snackBar 메시지 출력
          this.openSnackBar(data.message, data.state);
        },
        err => {
          let err_message = '';
          if (!(err.error instanceof Error)) {
            err_message = `[${err.error.state}] ${err.error.message}<br><a href="${err.error._link}">${err.error._link}</a>`;
          }          
          else err_message = err.error;
          this._angulartics2.eventTrack.next({ action: 'error', properties: { category: 'login', label: err_message }});

          // Error 출력하고 erro 페이지로 이동
          this._router.navigate(['/error'], { queryParams: { messge: err_message }});
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

  saveClient(headers: HttpHeaders, client:IClientDto) {
    // 분명히 있는데 agens.product.name 등을 뽑아내지 못함
    this._agens.product = (headers.get('agens.product.name') === null) ?
                // header에서 얻지 못하는 경우 hello_msg에서 추출 ( 가로가 나오기 전까지 )
                ( (client.message.indexOf('(') >= 0) ? client.message.substring(0,client.message.indexOf('(')-1) : client.message )
                : headers.get('agens.product.name') +' v'+ headers.get('agens.product.version');
    this._agens.client = client;

    // localStorage에 ssid 저장 (쓸곳이 많아서)
    localStorage.setItem('agens-ssid',client.ssid);
    localStorage.setItem('agens-product',this._agens.product);

    this._angulartics2.eventTrack.next({ action: 'client', properties: { category: 'login', label: this._agens.client.user_name+'_'+this._agens.client.user_ip }});
    this._angulartics2.eventTrack.next({ action: 'product', properties: { category: 'login', label: this._agens.product }});
  }
}
