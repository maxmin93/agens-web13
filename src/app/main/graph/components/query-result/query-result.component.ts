import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';
import { Input, Output, EventEmitter } from '@angular/core';

import { Subscription, timer } from 'rxjs';

import { IResponseDto } from '../../../../models/agens-response-types';
import * as CONFIG from '../../../../app.config';

const COLOR_BLUE = 'rgb(136, 139, 143)';
const COLOR_RED  = 'rgb(230, 36, 84)';
const COLOR_GRAY = 'rgb(96, 96, 96)';
const COLOR_GREEN ='rgb(21, 211, 178)';

@Component({
  selector: 'app-query-result',
  templateUrl: './query-result.component.html',
  styleUrls: ['./query-result.component.scss','../../graph.component.scss']
})
export class QueryResultComponent implements OnInit {

  counter: number = 0;
  messageText: string = ' ';
  messageColor: string = 'darkgray';        // error: '#ea614a'

  private _dto: IResponseDto;
  private elapsedTimeSubscription: Subscription = undefined;

  @Input() limitTime: number = 300;    // limitTime : sec

  @Output() overTime: EventEmitter<any> = new EventEmitter();

  @ViewChild('resultProgressBar') progressBar: ElementRef;
  @ViewChild('queryState') queryState: ElementRef;

  constructor() { }

  ngOnInit() {
  }

  ngOnDestroy(){
    if( this.elapsedTimeSubscription ) this.elapsedTimeSubscription.unsubscribe();
  }

  ///////////////////////////////////////////////

  setMessage(state:CONFIG.StateType, message:string){
    switch( state ){
      case CONFIG.StateType.PENDING: this.messageColor = COLOR_GREEN; break;
      case CONFIG.StateType.SUCCESS: this.messageColor = COLOR_BLUE; break;
      case CONFIG.StateType.FAIL: this.messageColor = COLOR_RED; break;
      default: this.messageColor = COLOR_GRAY;
    }
    this.messageText = message;    
  }

  toggleTimer(option:boolean=undefined){
    if( !option ) option = !this.elapsedTimeSubscription;
    if( option && !this.elapsedTimeSubscription ){
      this.toggleProgress(true);
      this.startTimer();
    }
    else if( !option && this.elapsedTimeSubscription ){
      this.toggleProgress(false);
      this.stopTimer();
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

  clear(){
    this.counter = 0;
    this.messageText = '...';
    this.messageColor = COLOR_GRAY;
  }

  abort(){
    this.toggleProgress(false);
    this.stopTimer();

    this.messageText = `User abort! (${this.elapsedTimeText()})`;
    this.messageColor = COLOR_GRAY;
  }

  setData(dto:IResponseDto){
    this.toggleTimer(false);

    this._dto = dto;
    this.setMessage(dto.state, dto.message);
  }

  /////////////////////////////////////////////////////////

  private elapsedTimeText(x:number=undefined){
    if( !x ) x = this.counter;
    let elapsedTimeText:string;
    if( x < 60 ) elapsedTimeText = `${x} seconds ..`;
    else elapsedTimeText = `${Math.floor(x/60)} minutes ${x%60} seconds ..`;

    return elapsedTimeText;
  }

  private startTimer(){
    this.elapsedTimeSubscription = timer(0, 1000).subscribe(
      (x:number) => {
        this.counter = x;
        this.setMessage(CONFIG.StateType.PENDING, this.elapsedTimeText(x));

        if( x >= this.limitTime ){
          this.overTime.emit(x);
          this.stopTimer();
        }
      },
      (err) => {},
      () => {
        // unsubscribe() 시킨다고 complete 가 실행되지 않음
        console.log( 'elapsedTimer observer is completed!' );
      }
    );
  }

  private stopTimer(){
    if( this.elapsedTimeSubscription ) this.elapsedTimeSubscription.unsubscribe();
    this.elapsedTimeSubscription = undefined;
  }

}
