import { Component, OnInit, ChangeDetectorRef } from '@angular/core';

import { AgensDataService } from '../../services/agens-data.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss']
})
export class MainComponent implements OnInit {

  private currentPath: string = '/';

  productTitle: string;
  currentMenu: string = "main";

  constructor(
    private cd: ChangeDetectorRef,
    private _api: AgensDataService
  ) { }

  ngOnInit() {
    this.productTitle = this._api.getClient().product_name+' '+this._api.getClient().product_version;
  }

}
