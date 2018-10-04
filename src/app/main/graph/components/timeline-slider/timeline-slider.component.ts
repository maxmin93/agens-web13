import { Component, OnInit, ViewChild, ElementRef, ChangeDetectorRef, SimpleChanges, Input, EventEmitter, Output } from '@angular/core';
import { MatSlider } from '@angular/material/slider';

import * as moment from 'moment';

@Component({
  selector: 'timeline-slider',
  templateUrl: './timeline-slider.component.html',
  styleUrls: ['./timeline-slider.component.scss']
})
export class TimelineSliderComponent implements OnInit {

  private initialized = false;

  isPaused:boolean = false;
  btnPlayDisabled:boolean = true;
  btnPauseDisabled:boolean = true;
  btnStopDisabled:boolean = true;
  sliderDisabled:boolean = true;
  @ViewChild('sliderElement') sliderElement: MatSlider;
  
  @Input() private format: string = 'YYYY-MM-DD';

  // moment datetime values
  private _values: any[] = [];

  // current value, min & max
  _value: any;
  get value():any { return this.initialized ? this.toFormat(this._value) : undefined; }  
  _min:any;
  get min():any { return this.initialized ? this.toFormat(this._min) : undefined; }
  _max:any;
  get max():any { return this.initialized ? this.toFormat(this._max) : undefined; }
  
  reset(){
    this.initialized = false;
    this._min = undefined;
    this._max = undefined;
    this._value = undefined;
    this._values = [];

    this.intervalId = undefined;
    this.intervalCount = 0;
    this.isPaused = false;

    this.disable = true;
    this._cd.detectChanges();
  }

  get values():any[] { return this._values; }
  @Input() set values(values:any[]){
    this.reset();
    if( !values || values.length == 0 ) return;

    // get unique values && sort
    let temp_values = values.filter((val,idx,self) => {
        return self.indexOf(val) === idx;
    }).sort();

    // convert date string to moment value
    this._values = temp_values.filter(x => { 
      return typeof x == 'string' && moment(x, this.format, true).isValid();
    }).map(x => moment(x, this.format).valueOf());
    if( this._values.length == 0 ) return;

    this._min = this._values[0];
    this._max = this._values[this._values.length-1];
    this._value = this.min;

    this.initialized = true;
    this.disable = false;
    this._cd.detectChanges();
  }

  get disable():boolean{ return !this.initialized; }
  @Input() set disable(b:boolean){    
    this.btnPlayDisabled = b;
    this.btnPauseDisabled = true;
    this.btnStopDisabled = false;
    this.sliderDisabled = b;
  }

  @Input('interval') private intervalSec:number = 3000;
  private intervalId:any = undefined;
  private intervalCount:number = 0;
  // UNIX datetime 변환을 위한 offset : .format('X')
  private inverseOffset:any = 0;

  // @Output() onStart: EventEmitter<any> = new EventEmitter<any>();
  @Output() onControl: EventEmitter<any> = new EventEmitter<any>();
  @Output() onChange: EventEmitter<any> = new EventEmitter<any>();
  @Output() onUpdate: EventEmitter<any> = new EventEmitter<any>();

  constructor(
    private _el: ElementRef, 
    private _cd: ChangeDetectorRef
  ) {
  }

  ngOnInit() {
    this.inverseOffset = moment(new Date()).utcOffset() * -1;
  }

  // ngOnChanges(changes: SimpleChanges): void {
  //   if(this.initialized) {
  //     for (let propName in changes) {
  //       let update = {};
  //       update[propName] = changes[propName].currentValue;
  //       console.log( 'ngOnChanges:', update );
  //     }
  //   }
  // }

  toFormat(val:number):string {
    return (val) ? moment(val).format(this.format).valueOf() : '';
  }

  update( data:any ) {
    if( moment(data, this.format, true).isValid() ){
      this._value = moment(data, this.format).valueOf();
      this.onUpdate.emit(data);
    }
  }

  onInputSlider( event ){
    this.btnStopDisabled = false;
    this.onChange.emit( this.toFormat(event.value) );
  }
  onChangeSlider( event ){
    this.btnStopDisabled = false;
    this.onChange.emit( this.toFormat(event.value) );
  }

  doPlay(){
    if( !this._values || this._values.length == 0 ) return;
    this.isPaused = false;
    this.btnPlayDisabled = true;
    this.btnPauseDisabled = false;
    this.btnStopDisabled = false;
    this.sliderDisabled = true;
    this.sliderElement.thumbLabel = true;
    
    this.onControl.emit('play');   // canvas clear before play timeline

    this.intervalCount = 0;
    this.intervalId = setInterval(()=>{
      if( this.intervalCount < this._values.length ){
        if( !this.isPaused ){
          this._value = this._values[this.intervalCount];
          this.onChange.emit( this.toFormat(this._value) );
          this._cd.detectChanges();
          this.intervalCount += 1;
        }
      }
      else this.doStop();
    }, this.intervalSec);
  }

  doPause(){
    this.isPaused = !this.isPaused;
    if( this.isPaused ) this.onControl.emit('paused');
    else this.onControl.emit('resumed');
  }

  doStop(){
    this.onControl.emit('stop');
    if( this.intervalId ){
      clearInterval(this.intervalId);
      this.intervalId = undefined;
    }
    this.isPaused = false;
    this.btnPlayDisabled = false;
    this.btnPauseDisabled = true;
    this.btnStopDisabled = true;
    this.sliderDisabled = false;
    this.sliderElement.thumbLabel = false;
    this._cd.detectChanges();
  }

}
