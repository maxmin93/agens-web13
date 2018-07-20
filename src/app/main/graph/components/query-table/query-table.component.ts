import { Component, OnInit, ViewChild, ElementRef } from '@angular/core';

import { DatatableComponent } from '@swimlane/ngx-datatable';

import { IRecord, IColumn, IRow } from '../../../../models/agens-data-types';
import * as CONFIG from '../../../../global.config';

@Component({
  selector: 'app-query-table',
  templateUrl: './query-table.component.html',
  styleUrls: ['./query-table.component.scss']
})
export class QueryTableComponent implements OnInit {

  recordColumns: Array<IColumn> = new Array();
  recordRows: Array<IRow> = new Array<IRow>();
  recordRowsCount: number = 0;
  isJsonCell: boolean = false;

  selectedCell: any = {};
  selectedRowIndex: number = -1;
  selectedColIndex: number = -1;

  @ViewChild('recordTable') recordTable: DatatableComponent;

  @ViewChild('tableCell') public tableCell: ElementRef;

  constructor() { }

  ngOnInit() {
  }

  /////////////////////////////////////////////////////////////////
  // Table Controllers
  /////////////////////////////////////////////////////////////////

  // 결과들만 삭제 : runQuery 할 때 사용
  clearResults(){
    // 테이블 비우고
    this.recordRowsCount = 0;
    this.recordRows = [];
    this.recordColumns = [];
    // 클릭된 셀 Json 출력도 비우고
    this.tableCell.nativeElement.style.visibility = 'hidden';   // this.isJsonCell = false;
    this.selectedCell = {};
    this.selectedRowIndex = -1;
    this.selectedColIndex = -1;
  }

  showResultRecord(record:IRecord){
    this.recordColumns = record.meta;
    this.recordRows = this.convertRowToAny(record.meta, record.rows);
    this.recordRowsCount = this.recordRows.length;
  }

  // rows를 변환 : Array<Array<any>> ==> Array<Map<string,any>>
  convertRowToAny(columns:Array<IColumn>, rows:Array<Array<any>>):Array<any>{
    let tempArray: Array<any> = new Array<any>();
    for( let row of rows ){
      let temp:any = {};
      for( let col of columns ){
        let key:string = col.name;
        let val:any = row[col.index];
        temp[key] = val;
      }
      tempArray.push(temp);
    }
    return tempArray;
  }

  onActivateTableRow(event){
    // console.log('Activate Event', event);
  }

  // 늘상 보이는 것으로 변경
  showJsonFormat(col:IColumn row:any) {
    this.tableCell.nativeElement.style.visibility = 'visible';   // this.isJsonCell = true;
    this.selectedCell = row[col.name];
    this.selectedRowIndex = row.$$index;
    this.selectedColIndex = col.index+1;
    document.querySelector('#tableCell').scrollIntoView();

    this._angulartics2.eventTrack.next({ action: 'showJson', properties: { category: 'graph', label: col.type+'.'+col.name }});
  }

  // 클립보드에 복사하기
  copyCellValue(){
    let $temp = $("<input>");
    $("body").append($temp);
    $temp.val($("#cellValue").text()).select();
    document.execCommand("copy");
    // console.log('copyCellValue :', $("#cellValue").text());
    $temp.remove();
  }

  // table 컬럼 정렬 기능은 제거
  // ** 이유
  // 1) JSON 형태에 대해서 정렬 안됨 : Node, Edge, Graph 등
  // 2) record 크기가 1000개 이상이면 브라우저 성능상 부하 가능 ==> order by 구문으로 처리하도록 유도
  recordSort(col:IColumn){
    //console.log('recordSort =>', col);
  }

}
