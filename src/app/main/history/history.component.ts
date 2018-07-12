import { Component, AfterViewInit } from '@angular/core';
import { ViewChild, ElementRef, NgZone } from '@angular/core';

import { Angulartics2 } from 'angulartics2';
import * as _ from 'lodash';

import { AgensDataService } from '../../services/agens-data.service';
import * as CONFIG from '../../global.config';

@Component({
  selector: 'app-history',
  templateUrl: './history.component.html',
  styleUrls: ['./history.component.scss']
})
export class HistoryComponent implements AfterViewInit {

  constructor(    
    private _angulartics2: Angulartics2,    
    private _api: AgensDataService,
  ) { }

  ngAfterViewInit() {
    this._api.changeMenu('history');
  }

}
