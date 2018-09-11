import { Component, AfterViewInit, OnInit, OnDestroy, ViewChild, ElementRef, ChangeDetectorRef } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Router, } from '@angular/router';

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

@Component({
  selector: 'app-plpy-editor',
  templateUrl: './plpy-editor.component.html',
  styleUrls: ['./plpy-editor.component.scss']
})
export class PlpyEditorComponent implements OnInit {

  // pg langs list
  pglangs: string[] = [];

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined
  ];
  public project: any = undefined;

  // controll whether make buttons to able or disable
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  pycode:string = '';
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
    this.editor.setValue( this.pycode );
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

  /////////////////////////////////////////////

  loadPglangList(){
    this.pglangs = [];
    this._api.core_pglang_list().subscribe(
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

  loadPlpyList(){
    this.tempRows = [];
    this.tablePlpyRows = [];
    this._api.core_pgproc_list().subscribe(
      x => {
        this.tempRows = x;
      },
      err => {
        console.log( 'pgproc/list ==> error' );
      },
      () => {
        if( this.tempRows ) this.tablePlpyRows = [...this.tempRows];
        this.sqlMessage = `function list : count = ${this.tablePlpyRows.length}`;
        this._cd.detectChanges();
      }
    );
  }

  loadPlpyDetail(pid:string){
    this._api.core_pgproc_detail(pid).subscribe(
      x => {
        this.selectedPlpy = x;
      },
      err => {
        console.log( 'pgproc/list ==> error' );
      },
      () => {
        if( this.selectedPlpy ) this.makePlpySource( this.selectedPlpy );
        this.sqlMessage = `source-load : oid=${this.selectedPlpy.id} (${this.selectedPlpy.type}/${this.selectedPlpy.lang})`;
        this._cd.detectChanges();
      }
    );
  }
  
  makePlpySource( row:any ){
    // console.log( 'makePlpySource:', row );
    if( !row.hasOwnProperty('source') ) this.editor.setValue( 'no source' );

    let source:string = this.trimNewline(row.source);
    this.editor.setValue( source );

    this.functionScript = 
`CREATE OR REPLACE FUNCTION "${row.name}" (
  ${row.args_type}
) RETURNS
  ${row.rtn_type}
AS $$
${source}
$$ LANGUAGE ${row.lang};
`;
  }

  // pg catalog 에서 내보낸 source 앞뒤로 '\n' 붙어 있는데 이를 제거
  trimNewline(str:string):string {
    if( str.length <= 2 ) return str.trim();
    if( str.startsWith('\n') ) str = str.substring(1);
    if( str.endsWith('\n') ) str = str.substring(0, str.length-2);
    return str;
  }

  /////////////////////////////////////////////

  onSelect({ selected }) {    // same to this.selected
    let row = selected.length > 0 ? selected[0] : undefined;
    if( !row || !row.hasOwnProperty('id') ) return;

    this.loadPlpyDetail( row.id );
  }

}
