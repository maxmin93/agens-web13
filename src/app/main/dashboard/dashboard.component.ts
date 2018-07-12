import { Component, AfterViewInit } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';

import { Angulartics2 } from 'angulartics2';
import * as _ from 'lodash';

import { AgensDataService } from '../../services/agens-data.service';
import * as CONFIG from '../../global.config';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements AfterViewInit {

  constructor(
    private _angulartics2: Angulartics2,    
    private _ngZone: NgZone,    
    private _api: AgensDataService,
  ) { 
    // prepare to call this.function from external javascript
    window['angularComponentRef'] = {
      zone: this._ngZone,
      cyCanvasCallback: () => this.cyCanvasCallback(),
      cyElemCallback: (value) => this.cyElemCallback(value),
      cyNodeCallback: (value) => this.cyNodeCallback(value),
      component: this
    };    
  }

  ngAfterViewInit() {
    this._api.changeMenu('main');
  }


  // graph canvas 클릭 콜백 함수
  cyCanvasCallback():void {
  }

  // graph elements 중 node 클릭 콜백 함수
  cyNodeCallback(cyTarget:any):void {
  }

  // graph elements 클릭 콜백 함수
  cyElemCallback(cyTarget:any):void {

    // // qtip2
    // cyTarget.qtip({ 
    //   style: 'qtip-blue',
    //   position: { my: 'bottom left', at: 'top right' },          
    //   content: {
    //       title: cyTarget.data('labels')[0]+' ['+cyTarget.id()+']',
    //       text: function(){ 
    //         var text = 'name: '+cyTarget.data('name')+'<br>size: '+cyTarget.data('size');
    //         if(cyTarget.data('props').hasOwnProperty('desc')) text += '<br>desc: '+cyTarget.data('props')['desc'];
    //         return text;
    //       }
    //   } });
  }

}
