import { Component, OnInit, Input, ViewChild, ChangeDetectorRef } from '@angular/core';

import { MatBottomSheet, MatBottomSheetRef } from '@angular/material';
import { DatatableComponent } from '@swimlane/ngx-datatable';

import { CellViewerComponent } from '../../sheets/cell-viewer/cell-viewer.component';

import { IRecord, IColumn, IRow } from '../../../../models/agens-data-types';
import * as CONFIG from '../../../../app.config';

@Component({
  selector: 'app-query-table',
  templateUrl: './query-table.component.html',
  styleUrls: ['./query-table.component.scss','../../graph.component.scss']
})
export class QueryTableComponent implements OnInit {

  @Input() data:IRecord;

  recordColumns: Array<IColumn> = new Array();
  recordRows: Array<IRow> = new Array<IRow>();
  recordRowsCount: number = 0;
  isJsonCell: boolean = false;

  selected: any[] = [];
  selectedCell: any = {};
  selectedRowIndex: number = -1;
  selectedColIndex: number = -1;

  @ViewChild('recordTable') recordTable: DatatableComponent;

  constructor(
    private _cd: ChangeDetectorRef,
    private _sheet: MatBottomSheet
  ) { }

  ngOnInit() {
  }

  /////////////////////////////////////////////////////////////////
  // Table Controllers
  /////////////////////////////////////////////////////////////////

  // 결과들만 삭제 : runQuery 할 때 사용
  clear(){
    // 테이블 비우고
    this.recordRowsCount = 0;
    this.recordRows = [];
    this.recordColumns = [];

    this.selectedCell = {};
    this.selectedRowIndex = -1;
    this.selectedColIndex = -1;

    // change Detection by force
    this._cd.detectChanges();
  }

  setData(record:IRecord){
    this.recordColumns = record.columns;
    this.recordRows = this.convertRowToAny(record.columns, record.rows);
    this.recordRowsCount = this.recordRows.length;
    
    // change Detection by force
    this._cd.detectChanges();
  }

  // rows를 변환 : Array<Array<any>> ==> Array<Map<string,any>>
  convertRowToAny(columns:Array<IColumn>, rows:Array<IRow>):Array<any>{
    let tempArray: Array<any> = new Array<any>();
    for( let row of rows ){
      let temp:any = {};
      for( let col of columns ){
        let key:string = col.name;
        let val:any = row.row[col.index];
        temp[key] = val;
      }
      tempArray.push(temp);
    }
    return tempArray;
  }

  // table 컬럼 정렬 기능은 제거
  // ** 이유
  // 1) JSON 형태에 대해서 정렬 안됨 : Node, Edge, Graph 등
  // 2) record 크기가 1000개 이상이면 브라우저 성능상 부하 가능 ==> order by 구문으로 처리하도록 유도
  // recordSort(col:IColumn){
  //   console.log('recordSort =>', col);
  // }

  onSelect(event) {
    // console.log('Event: select', event, this.selected);
    this.openBottomSheet();
  }

  openBottomSheet(): void {
    const bottomSheetRef = this._sheet.open(CellViewerComponent, {
      ariaLabel: 'Json viewer',
      panelClass: 'sheet-cell-viewer',
      data: (this.selected) ? this.selected[0] : null
    });

    bottomSheetRef.afterDismissed().subscribe(() => {
      console.log('Bottom sheet has been dismissed.');
    });
  }

}
