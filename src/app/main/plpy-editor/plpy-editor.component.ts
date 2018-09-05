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

  private handlers: Array<Subscription> = [
    undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined, undefined
  ];
  public project: any = undefined;

  // controll whether make buttons to able or disable
  isLoading: boolean = false;
  // CodeMirror Handler
  editor: any = undefined;
  // CodeMirror Editor : initial value
  pycode:string =
`match path1=(c:customer)-[]->(:"order")-[]->(p:product)-[]-(t:category)
where c.id in ['CENTC','NORTS','SPECD','GROSR','THEBI','FRANR'] and t.id in [4,8,7]
match path2=(:category)-[]->(customer)
return path1, path2;
`;

  // 출력: 테이블 labels
  tablePlpyRows: Array<any> = new Array<any>();
  tablePlpyColumns: Array<any> = [
    { name: 'TYPE', prop: 'type' },
    { name: 'ID', prop: 'id' },
    { name: 'NAME', prop: 'name' },
    { name: 'SIZE', prop: 'size' },
  ];
  selectedPlpy: any = undefined;
    
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
  }

  ngOnDestroy(){
    this.clearSubscriptions();
  }

  ngAfterViewInit() {
    this._api.changeMenu('pyeditor');

    // CodeMirror : get mime type
    var mime = 'application/x-cypher-query';
    this.editor = new CodeMirror.fromTextArea( this.plpyEditor.nativeElement, {
      // keyMap: "sublime",
      indentUnit: 4,
      mode: mime,
      indentWithTabs: false,
      smartIndent: true,
      lineNumbers: true,
      styleActiveLine: true,
      matchBrackets: true,
      autofocus: true,
      theme: 'idea'
    });
    // CodeMirror : initial value
    this.editor.setValue( this.pycode );
    this.editor.setSize('100%', '60px');
    
    this.installCodeMirrorAddons();
    this.editor.setOption("extraKeys", {
      // Tab: function(cm) {
      //   var spaces = Array(cm.getOption("indentUnit") + 1).join(" ");
      //   cm.replaceSelection(spaces);
      // },
      "Tab": "insertTab",
      "Shift-Tab": "indentLess",
      "Alt-Enter": "insertLineAfter",
      "Shift-Alt-Enter": "insertLineBefore",  
      "Ctrl-/": "toggleComment",      
      // function(cm) {    // 
      //   console.log(cm);
      //   var pos = cm.getCursor();
      //   cm.setCursor({ line: pos.line, ch: 0 });
      //   cm.lineComment(pos.line, pos.line);
      // }
    });

  }

  private installCodeMirrorAddons(){
    var cmds = CodeMirror.commands;
    var Pos = CodeMirror.Pos;

    function insertLine(cm, above) {
      if (cm.isReadOnly()) return CodeMirror.Pass
      cm.operation(function() {
        var len = cm.listSelections().length, newSelection = [], last = -1;
        for (var i = 0; i < len; i++) {
          var head = cm.listSelections()[i].head;
          if (head.line <= last) continue;
          var at = Pos(head.line + (above ? 0 : 1), 0);
          cm.replaceRange("\n", at, null, "+insertLine");
          cm.indentLine(at.line, null, true);
          newSelection.push({head: at, anchor: at});
          last = head.line + 1;
        }
        cm.setSelections(newSelection);
      });
      cm.execCommand("indentAuto");
    }

    cmds.insertLineAfter = function(cm) { return insertLine(cm, false); };
    cmds.insertLineBefore = function(cm) { return insertLine(cm, true); };

    /////////////////////////////////////////////////////////////////////
    // addon/comment/comment.js

    cmds.toggleComment = function(cm) {
      let ranges = cm.listSelections();
      for (let i = ranges.length - 1; i >= 0; i--) {
        let from = ranges[i].from(), to = ranges[i].to();
        console.log(from, to);
        for(let j = from.line; j <= to.line; j++ ){
          if( j != from.line || j != to.line ){
            if( j == from.line && from.ch == cm.getLine(j).length - 1 ) continue;
            if( j == to.line && to.ch == 0 ) continue;
          }
          let line = cm.getLine(j).trim();
          // do uncomment
          if( line.startsWith('--') ) {
            line = line.substring(2, line.length).trim();
          }
          // do comment 
          else {
            line = '-- '+line;
          }
          cm.replaceRange( line, {"line": j, "ch": 0}, {"line": j, "ch": cm.getLine(j).length })
        }
        cm.setCursor(to);
      }  
    };
    
  }

  clearSubscriptions(){
    this.handlers.forEach(x => {
      if( x ) x.unsubscribe();
      x = undefined;
    });
  }

  /////////////////////////////////////////////

  onSelectTable(event){

  }

}
