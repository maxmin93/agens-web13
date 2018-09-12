import { Component, AfterViewInit, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, } from '@angular/router';
import { NgForm, FormGroup, FormControl, Validators } from '@angular/forms';

import { Observable, Subscription } from 'rxjs';
import { filter } from 'rxjs/operators';

// ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { MatDialog } from '@angular/material';

import * as _ from 'lodash';

import { AgensDataService } from '../../services/agens-data.service';
import { AgensUtilService } from '../../services/agens-util.service';
import { StateType } from '../../app.config';

import { IGraph, ILabel, IElement, INode, IEdge, IStyle, IRecord, IColumn, IRow, IEnd } from '../../models/agens-data-types';

declare var CodeMirror: any;

const MAX_DESC_SIZE:number = 255;

@Component({
  selector: 'app-plpy-editor',
  templateUrl: './plpy-editor.component.html',
  styleUrls: ['./plpy-editor.component.scss']
})
export class PlpyEditorComponent implements OnInit {

  // pg langs list
  pglangs: string[] = [];

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined
  ];
  public project: any = undefined;

  // controll whether make buttons to able or disable
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // SQL statement: create or replace function ...
  functionScript:string = '';

  // 출력: 테이블 labels
  tempRows: any[] = [];
  tablePlpyRows: any[] = [];
  tablePlpyColumns: any[] = [
    { name: 'Name', prop: 'name' },
    { name: 'Arguments', prop: 'args_type' },
    { name: 'Return', prop: 'rtn_type' },
  ];

  selectedPlpy: any = undefined;
  selected: any[] = [];            // for ngx-datatable selector
  
  sqlMessage:string = '';

  // ** NOTE : 포함하면 AOT 컴파일 오류 떨어짐 (offset 지정 기능 때문에 사용)
  @ViewChild('tablePlpy') tablePlpy: DatatableComponent;   
  @ViewChild('progressBar') progressBar: ElementRef;
  @ViewChild('plpyEditor', {read: ElementRef}) plpyEditor: ElementRef;

  @ViewChild('formName', {read: ElementRef}) plpyName: ElementRef;
  @ViewChild('formLang', {read: ElementRef}) plpyLang: ElementRef;
  @ViewChild('formArgs', {read: ElementRef}) plpyArgs: ElementRef;
  @ViewChild('formRtn', {read: ElementRef}) plpyRtn: ElementRef;
  @ViewChild('formDesc', {read: ElementRef}) plpyDesc: ElementRef;

  procFormGrp: FormGroup;
  procNameCtl: FormControl;
  procLangCtl: FormControl;
  procArgsCtl: FormControl;
  procRtnCtl: FormControl;
  procDescCtl: FormControl;

  constructor(    
    private _cd: ChangeDetectorRef,
    private _router: Router,
    public dialog: MatDialog,    
    private _api: AgensDataService,
    private _util: AgensUtilService,
  ) { }

  ngOnInit() {    
    this._api.changeMenu('pyeditor');

    // CodeMirror : get mime type
    var mime = 'text/x-python';
    this.editor = new CodeMirror.fromTextArea( this.plpyEditor.nativeElement, {
      mode: mime, // {name: "python", version: 2, singleLineStringErrors: false},
      keyMap: "sublime",
      lineNumbers: true,
      tabSize: 2,
      indentUnit: 2,
      indentWithTabs: false,
      smartIndent: true,
      styleActiveLine: true,
      matchBrackets: true,
      autofocus: true,
      theme: 'idea'
    });
    // CodeMirror : initial value
    this.editor.setValue( '' );

    // Form Controls
    this.procNameCtl = new FormControl('', [ 
      Validators.required, Validators.pattern(/^[a-zA-Z]{1}[a-zA-Z0-9_]{2,42}$/)
    ]);
    this.procLangCtl = new FormControl('', [Validators.required]);
    this.procArgsCtl = new FormControl('', []); //Validators.pattern(/^(\w+)[ ]+(\w+)([,]{1}[ ]*(\w+)[ ]+(\w+))*$/)
    this.procRtnCtl = new FormControl('', [Validators.required]);
    this.procDescCtl = new FormControl('', [Validators.maxLength(MAX_DESC_SIZE)]);

    this.procFormGrp = new FormGroup({
      name: this.procNameCtl,
      lang: this.procLangCtl,
      args_type: this.procArgsCtl,
      rtn_type: this.procRtnCtl,
      desc: this.procDescCtl
    });    
  }

  ngOnDestroy(){
    this.clearSubscriptions();
  }

  ngAfterViewInit() {
    this.loadPlpyList();
    this.loadPglangList();
  }

  clearSubscriptions(){
    this.handlers.forEach(x => {
      if( x ) x.unsubscribe();
      x = undefined;
    });
  }

  onSelect({ selected }) {    // same to this.selected
    let row = selected.length > 0 ? selected[0] : undefined;
    if( !row || !row.hasOwnProperty('id') ) return;

    this.loadPlpyDetail( row.id );
  }

  /////////////////////////////////////////////

  loadPglangList(){
    this.pglangs = [];
    this.handlers[0] = this._api.core_pglang_list().subscribe(
      x => {
        this.pglangs = x;
      },
      err => {
        console.log( 'pglang/list ==> error' );
      },
      () => {
        this._cd.detectChanges();
      }
    );
  }

  loadPlpyList(msgFlag=true){
    this.tempRows = [];
    this.tablePlpyRows = [];
    this.handlers[1] = this._api.core_pgproc_list().subscribe(
      x => {
        this.tempRows = x;
      },
      err => {
        console.log( 'pgproc/list ==> error' );
      },
      () => {
        if( this.tempRows ) this.tablePlpyRows = [...this.tempRows];
        if( msgFlag ) this.sqlMessage = `functions.count = ${this.tablePlpyRows.length}`;
        this._cd.detectChanges();
      }
    );
  }

  loadPlpyDetail(pid:string){
    this.handlers[2] = this._api.core_pgproc_detail(pid).subscribe(
      x => {
        this.selectedPlpy = x;
        this.selectedPlpy.source = this.recursiveTrim(x.source);

        this.procNameCtl.setValue( x.name );
        this.procLangCtl.setValue( x.lang );
        this.procArgsCtl.setValue( x.args_type );
        this.procRtnCtl.setValue( x.rtn_type );
        this.procDescCtl.setValue( x.desc );
        this.editor.setValue( this.selectedPlpy.source );
      },
      err => {
        console.log( 'pgproc/list ==> error' );
      },
    );
  }
  
  // 최대 10회 반복 : 공백 라인 지우기
  recursiveTrim(str:string):string{
    let temp = this.trimBlankLine( str );
    for( var _i=0; _i<10; _i+=1 ){
      if( temp == str ) break;
      str = temp;
      temp = this.trimBlankLine( str );
    }
    return temp;
  }

  // pg catalog 에서 내보낸 source 앞뒤로 '\n' 붙어 있는데 이를 제거
  trimBlankLine(str:string):string {
    if( str.length <= 2 ) str = str.trim();
    else{ 
      if( str.indexOf('\n') >= 0 ){
        let firstLine = str.substring(0, str.indexOf('\n')+1 ).trim();
        if( firstLine.length == 0 ) str = str.substring( str.indexOf('\n')+1 );
      }
      if( str.lastIndexOf('\n') >= 0 ){
        let lastLine = str.substring( str.lastIndexOf('\n')+1 ).trim();
        if( lastLine.length == 0 ) str = str.substring( 0, str.lastIndexOf('\n') );
      }
    }
    return str;
  }

  /////////////////////////////////////////////

  newPlpy(){
    this.selectedPlpy = undefined;

    this.procNameCtl.setValue('');
    let langs = this.pglangs.filter(x=>x.startsWith('plpython'));
    this.procLangCtl.setValue( langs.length > 0 ? langs[0] : '' );
    this.procArgsCtl.setValue('');
    this.procRtnCtl.setValue('');
    this.procDescCtl.setValue('');
    this.editor.setValue('');
  }

  savePlpy(){
    let newPlpy = this.procFormGrp.getRawValue();    
    newPlpy.id = this.selectedPlpy ? this.selectedPlpy.id : '-1';
    newPlpy.name = newPlpy.name.trim();
    newPlpy.type = this.selectedPlpy ? this.selectedPlpy.type : 'normal';
    newPlpy.args_type = newPlpy.args_type.trim();
    newPlpy.rtn_type = newPlpy.rtn_type.trim();
    newPlpy.desc = newPlpy.desc.trim();
    // 
    // **NOTE: source 양쪽에 \n 이 없으면 SQL 실행시 unindent error 발생함!!
    // 
    newPlpy.source = this.recursiveTrim( this.editor.getValue() );

    // invalid case
    if( this.procFormGrp.invalid || this.editor.getValue().trim().length <= 2 ){
      console.log( 'savePlpy invalid:', this.procFormGrp.invalid, newPlpy.source.trim().length, newPlpy );
      return;
    } 

    this.handlers[3] = this._api.core_pgproc_save( newPlpy ).subscribe(
      x => {
        this.sqlMessage = x.state +': '+ x.message;
      },
      err => {
        console.log( 'pgproc/save ==> error', err );
      },
      () => {
        this.loadPlpyList(false);
        this._cd.detectChanges();
      }
    );
  }

  deletePlpy(){
    if( !this.selectedPlpy ) return;
    this.handlers[4] = this._api.core_pgproc_delete(this.selectedPlpy).subscribe(
      x => {
        this.sqlMessage = x.state +': '+ x.message;
      },
      err => {
        console.log( 'pgproc/delete ==> error', err );
      },
      () => {
        this.loadPlpyList(false);
        this._cd.detectChanges();
      }
    );
  }
  
}
