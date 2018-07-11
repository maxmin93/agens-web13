import { Component, OnInit } from '@angular/core';
import { MatSnackBar } from '@angular/material';

import { AgensDataService } from '../../../services/agens-data.service';

@Component({
  selector: 'app-dashboard',
  templateUrl: './dashboard.component.html',
  styleUrls: ['./dashboard.component.scss']
})
export class DashboardComponent implements OnInit {

  constructor(
    private _api: AgensDataService,
    public _snackBar: MatSnackBar    
  ) { }

  ngOnInit() {
    console.log( 'Dashboard:', this._api.getClient() );
  }

}
