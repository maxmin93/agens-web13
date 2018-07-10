import { Component, OnInit } from '@angular/core';
import { Router, NavigationEnd } from '@angular/router';

import { Angulartics2GoogleAnalytics } from 'angulartics2/ga';
import { Angulartics2 } from 'angulartics2';

// Google Analytics
declare let ga: Function;

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.scss']
})
export class AppComponent implements OnInit {

  constructor(
    public angulartics2GoogleAnalytics: Angulartics2GoogleAnalytics,
    public router: Router,
    private angulartics2: Angulartics2
  ) {
    // this.router.events.subscribe(event => {
    //   if (event instanceof NavigationEnd) {
    //     ga('set', 'page', event.urlAfterRedirects);
    //     ga('send', 'pageview');
    //   }
    // });
  }

  ngOnInit(){
    // this.angulartics2.setUsername.next( 'unknown' );
  }

}
