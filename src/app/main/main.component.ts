import { Component, OnInit, AfterViewInit, ChangeDetectorRef } from '@angular/core';
import { Router, ActivatedRoute, NavigationEnd } from '@angular/router';
import { Title } from '@angular/platform-browser';

import { MatSnackBar } from '@angular/material';

import { Angulartics2 } from 'angulartics2';

import { AgensDataService } from '../services/agens-data.service';

@Component({
  selector: 'app-main',
  templateUrl: './main.component.html',
  styleUrls: ['./main.component.scss'],
})
export class MainComponent implements OnInit, AfterViewInit {

  productTitle: string;
  currentMenu: string = 'main';

  private currentPath: string = '/';

  constructor(
    private _router: Router,
    private cd: ChangeDetectorRef,
    private _title: Title,
    public _snackBar: MatSnackBar,    
    private _api: AgensDataService
  ) { 
    this._router.events.subscribe(s => {
      if (s instanceof NavigationEnd) {
        this.currentPath = this._router.url.split('#')[0];
        const tree = _router.parseUrl(this._router.url);
        if (tree.fragment) {
          console.log( "router =>", this.currentPath, '#'+tree.fragment );
          this.scrollToAnchor(tree.fragment, 100); 
        }
      }
    });        
  }

  ngOnInit() {
    this._api.getProductTitle$().subscribe(
      x => this.productTitle = x
    );
  }

  ngAfterViewInit(){
    this._api.getProductTitle$().subscribe(
      x => {
        // ExpressionChangedAfterItHasBeenCheckedError 방지 (ChangeDetectorRef 비추)
        Promise.resolve(null).then(() => this.productTitle = x);
      }
    );
    this._api.getCurrentMenu$().subscribe(
      x => {
        // ExpressionChangedAfterItHasBeenCheckedError 방지 (ChangeDetectorRef 비추)
        Promise.resolve(null).then(() => this.currentMenu = x);
      }
    );
  }

  /**
   * Scroll to anchor
   *
   * @param {string} location Element id
   * @param {string} wait     Wait time in milliseconds
   */
  public scrollToAnchor(location: string, wait: number): void {
    const element = document.querySelector('#' + location)
    console.log( 'scrollToAnchor:', element );
    if (element) {
      setTimeout(() => {
        element.scrollIntoView({behavior: 'smooth', block: 'start', inline: 'nearest'})
      }, wait)
    }
  }

  // 작동하지 않음 (이유는 모르겠음. 전에는 되던건데) ==> 제거!!
  toTheTop(){
    this.scrollToAnchor('top', 100); 
  }

}
