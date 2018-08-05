import { Component, AfterViewInit } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';

import { Router, NavigationEnd } from '@angular/router';
import { HttpClient, HttpParams, HttpHeaders } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import { Observable } from 'rxjs';

import { MatSnackBar } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { Angulartics2 } from 'angulartics2';
import * as _ from 'lodash';

import { AgensDataService } from '../../services/agens-data.service';

import { IResponseDto } from '../../models/agens-response-types';
import { ILogs } from '../../models/agens-manager-types';
import * as CONFIG from '../../global.config';
import { concatAll } from '../../../../node_modules/rxjs/operators';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements AfterViewInit {

  private displayedColumns: Array<string> = ['id','userIp','query','state','message','startTime','endTime'];
  // data array
  logRows: ILogs[] = [];
  // filtering 을 위한 임시 array
  tmpRows: ILogs[] = [];

  @ViewChild('logsTable') logsTable: DatatableComponent;

  @ViewChild('progressBar') progressBar: ElementRef;

  constructor(    
    private _angulartics2: Angulartics2,    
    private _router: Router,
    private _api: AgensDataService,
  ) { }

  ngAfterViewInit() {
    this._api.changeMenu('history');

    this.loadLogs();
  }

  toggleProgress(option:boolean=undefined){
    if( option === undefined ){
      this.progressBar.nativeElement.style.visibility = 
        (this.progressBar.nativeElement.style.visibility == 'visible') ? 'hidden' : 'visible';
    }
    else{
      this.progressBar.nativeElement.style.visibility = option ? 'visible' : 'hidden';
    }
  }

  /////////////////////////////////////////////////////////////////
  // Data Handlers
  /////////////////////////////////////////////////////////////////

  clear(){
    this.logRows = [];
    this.tmpRows = [];
  }

  reload(){
    this.clear();
    this.loadLogs();
  }

  // call API: manager/logs  
  loadLogs(){

    this.toggleProgress(false);

    this._api.mngr_history().pipe( concatAll() )
    .subscribe(
        data => {
          this.tmpRows.push( <ILogs>data );
        },
        err => {
          this.toggleProgress(false);
          this._api.setResponses(<IResponseDto>{
            group: 'core.command.deleteLabel',
            state: CONFIG.StateType.ERROR,
            message: (err instanceof HttpErrorResponse) ? err.message : 'Unknown Error'
          });
          if( !(err instanceof HttpErrorResponse) ) console.log( 'Unknown Error', err );
  
          this._router.navigate(['/login'], { queryParams: { returnUrl: this._router.url }});
        },
        () => {
          this.toggleProgress(false);
          // cache our list
          this.logRows = [...this.tmpRows];

          // snackBar 메시지 출력
          this._api.setResponses(<IResponseDto>{
            group: 'manager.history',
            state: CONFIG.StateType.SUCCESS,
            message: 'loading logs.size='+this.logRows.length
          });
        });    
  }

  // Table page event
  toggleLogExpandRow(row, col) {
    // console.log('Toggled Expand Row!', col);
    row._selectedColumn = col;
    this.logsTable.rowDetail.toggleExpandRow(row);
  }

  onRowDetailToggle(event) {
    // console.log('Detail Toggled', event);   // type=row, value={row}
  }

  onActivateTableLabels(event){
    // console.log('onActivateTableLabels: ', event);
  }

  updateFilter(event) {
    const val = event.target.value.toLowerCase();

    // filter our data
    const temp = this.tmpRows.filter(function(d) {
      return d.userIp.toLowerCase().indexOf(val) !== -1 || !val;
    });

    // update the rows
    this.logRows = temp;
  }    
}
