import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';

import { IResultDto } from '../../../models/agens-response-types';

@Component({
  selector: 'app-query-state',
  template: `
<div #progressBar style='visibility:hidden;'>
  <mat-progress-bar color="accent" mode="indeterminate">Loading...</mat-progress-bar>
</div>
<div class="card__graphdata-foot">
  <span class="card__graphdata-food-title">Result</span>
  <form>
    <textarea rows="2" #queryState type="text" readonly [value]="messageText" [style.color]="messageColor">
    </textarea>
  </form>
</div>
  `,
  styles: [`
.card__graphdata-foot { 
    display: flex; 
    border-top: 1px solid #ccc; 

    span { 
        background-color: #eee; 
        width: 80px; 
        display: flex; 
        justify-content: center; 
        align-items: center;             
        border-right: 1px solid #ccc; 
        font-size: 0.766rem; 
        font-weight: 700; 
        color: #585858;
    }

    form { 
        flex-grow: 2; 
        padding: .4rem 0; 

        textarea { 
            width: 99.8%;
            min-height: 26px;                              
            padding-left: 1rem;
            vertical-align: middle;                  
            outline: none; 
            resize: none; 
            box-sizing: border-box; 
            font-size: .815rem; 
            color: #383838; 
            border: none;
        }
    }
}
  `]
})
export class QueryStateComponent implements OnInit {

  dto: IResultDto;
  messageText: string = '';
  messageColor: string = '';        // error: '#ea614a'

  elapsedTimeHandler: any;

  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('queryState') queryState: ElementRef;

  constructor() { }

  ngOnInit() {
  }

  startTimer(){
    // **NOTE: In setInterval, text.value update by querySelector
    // setInterval() 안에서는 component 멤버 변수에 대한 업데이트 가 안된다.
    // querySelector로 DOM에 직접 값을 써야 변경됨
    // let textMessage = this._eleRef.nativeElement.querySelector('textarea#agensMessage');
    let elapsedSeconds = 0;
    this.elapsedTimeHandler = setInterval(function(){
      elapsedSeconds += 1;
      let elapsedTimeText = elapsedSeconds+' seconds';
      if( elapsedSeconds >= 60 ) elapsedTimeText = Math.floor(elapsedSeconds/60)+' minutes '+(elapsedSeconds%60)+' seconds'
      // 1초마다 메시지 출력
      this.resultMessage = { fontColor: 'darkgray', text: elapsedTimeText };
      textMessage.value = `[Executing] elapsed ${elapsedTimeText} ...`;
      textMessage.style.color = this.resultMessage.fontColor;
    }, 1000);
  }

  stopTimer(){
    if( this.elapsedTimeHandler !== null ){
      clearInterval(this.elapsedTimeHandler);
      this.elapsedTimeHandler = null;
    }
  }

}
