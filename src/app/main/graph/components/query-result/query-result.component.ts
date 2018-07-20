import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Input, Output, EventEmitter } from '@angular/core';

import { Subscription, timer } from 'rxjs';

import { IResponseDto } from '../../../../models/agens-response-types';
import * as CONFIG from '../../../../global.config';

@Component({
  selector: 'app-query-result',
  templateUrl: './query-result.component.html',
  styleUrls: ['./query-result.component.scss']
})
export class QueryResultComponent implements OnInit {

  messageText: string = '...';
  messageColor: string = 'darkgray';        // error: '#ea614a'

  private _dto: IResponseDto;

  @Input() limitTime: number = 30;    // limitTime : sec

  @Output() overTime: EventEmitter<any> = new EventEmitter();

  private elapsedTimeText: string = '';
  private elapsedTimeSubscription: Subscription = undefined;

  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('queryState') queryState: ElementRef;

  constructor() { }

  ngOnInit() {
  }

  ngOnDestroy(){
    if( this.elapsedTimeSubscription ) this.elapsedTimeSubscription.unsubscribe();
  }

  ///////////////////////////////////////////////

  get dto():IResponseDto {
    return this._dto;
  }

  @Input()
  set dto(dto: IResponseDto){
    this._dto = dto;
  }

  ///////////////////////////////////////////////

  setMessage(state:CONFIG.StateType, message:string){
    switch( state ){
      case CONFIG.StateType.SUCCESS: this.messageColor = 'rgb(0, 64, 255)'; break;
      case CONFIG.StateType.FAIL: this.messageColor = 'rgb(255, 64, 0)'; break;
      default: this.messageColor = 'rgb(96,96,96)';
    }
    this.messageText = message;    
  }

  toggleTimer(){
    if( this.elapsedTimeSubscription ){
      this.toggleProgress(false);
      this.stopTimer();
    }
    else {
      this.toggleProgress(true);
      this.startTimer();
    }
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

  /////////////////////////////////////////////////////////

  private startTimer(){
    this.elapsedTimeSubscription = timer(0, 1000).subscribe(
      (x:number) => {
        if( x < 60 ) this.elapsedTimeText = `${x} seconds .. (until limit ${this.limitTime} sec)`;
        else this.elapsedTimeText = `${Math.floor(x/60)} minutes ${x%60} seconds .. (until limit ${this.limitTime} sec)`;
        this.setMessage(CONFIG.StateType.PENDING, this.elapsedTimeText);

        if( x >= this.limitTime ){
          this.overTime.emit(x);
          this.stopTimer();
        }
      },
      (err) => {},
      () => {
        // unsubscribe() 시킨다고 complete 가 실행되지 않음
        console.log( 'Timer observer is completed!' );
      }
    );
  }

  private stopTimer(){
    if( this.elapsedTimeSubscription ) this.elapsedTimeSubscription.unsubscribe();
    this.elapsedTimeSubscription = undefined;
  }

}
