import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { BrowserModule } from '@angular/platform-browser';
import { FormsModule, ReactiveFormsModule } from '@angular/forms';

import { Title } from '@angular/platform-browser';

import { HttpClientModule } from '@angular/common/http';
import { BrowserAnimationsModule } from '@angular/platform-browser/animations';

// Router
import { appRoutes, appRoutingProviders } from './app.routes';

// Material : 이거 하나면 하위 모듈들 모두 커버 되는듯..
import { CdkTableModule } from '@angular/cdk/table';
import {
  MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
  MatCardModule, MatCheckboxModule, MatChipsModule, MatDatepickerModule, MatDialogModule,
  MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule, MatInputModule,
  MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule, MatProgressBarModule,
  MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule, MatSidenavModule,
  MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule, MatStepperModule,
  MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, MatTreeModule
} from '@angular/material';

// UI Libraries
import { NgxDatatableModule } from '@swimlane/ngx-datatable';
import { PrettyJsonModule } from 'angular2-prettyjson';

// Components
import { AppComponent } from './app.component';
import { LoginComponent } from './login/login.component';
import { MainComponent } from './main/main.component';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { GraphComponent } from './main/graph/graph.component';
import { HistoryComponent } from './main/history/history.component';

// Services
import { AuthGuardService } from './services/auth-guard.service';
import { AgensDataService } from './services/agens-data.service'
import { AgensUtilService } from './services/agens-util.service'
import { AgensGraphService } from './services/agens-graph.service';

// Dialogs
import { ConfirmDeleteLabelDialog } from './main/dashboard/dialogs/confirm-delete-label.dialog';
import { QueryResultComponent } from './main/graph/components/query-result/query-result.component';
import { QueryGraphComponent } from './main/graph/components/query-graph/query-graph.component';
import { QueryTableComponent } from './main/graph/components/query-table/query-table.component';
import { StatGraphComponent } from './main/graph/components/stat-graph/stat-graph.component';
import { MetaGraphComponent } from './main/graph/sheets/meta-graph/meta-graph.component';
import { CellViewerComponent } from './main/graph/sheets/cell-viewer/cell-viewer.component';
import { EditGraphComponent } from './main/graph/sheets/edit-graph/edit-graph.component';
import { TimelineSliderComponent } from './main/graph/components/timeline-slider/timeline-slider.component';
import { PlpyEditorComponent } from './main/plpy-editor/plpy-editor.component';

import { ImageExportDialog } from './main/graph/dialogs/image-export.dialog';
import { ProjectOpenDialog } from './main/graph/dialogs/project-open-dialog';
import { ProjectSaveDialog } from './main/graph/dialogs/project-save-dialog';
import { OverlayGraphComponent } from './main/graph/sheets/overlay-graph/overlay-graph.component';

// Report (public page)
import { ReportComponent } from './report/report.component';
import { RoundProgressModule } from 'angular-svg-round-progressbar';

@NgModule({
  declarations: [
    AppComponent,
    MainComponent,
    DashboardComponent,
    LoginComponent,
    GraphComponent,
    HistoryComponent,

    ConfirmDeleteLabelDialog,

    QueryResultComponent,
    MetaGraphComponent,
    QueryGraphComponent,
    QueryTableComponent,
    CellViewerComponent,
    EditGraphComponent,
    TimelineSliderComponent,
    PlpyEditorComponent,
    StatGraphComponent,

    ImageExportDialog,
    ProjectOpenDialog,
    ProjectSaveDialog,
    OverlayGraphComponent,

    ReportComponent,
  ], 
  // directives, components, and pipes owned by this NgModule
  imports: [
    FormsModule,
    CommonModule,
    ReactiveFormsModule,
    BrowserModule,
    BrowserAnimationsModule,

    HttpClientModule,

    CdkTableModule,
    MatAutocompleteModule, MatBadgeModule, MatBottomSheetModule, MatButtonModule, MatButtonToggleModule,
    MatCardModule, MatCheckboxModule, MatChipsModule, MatStepperModule, MatDatepickerModule,
    MatDialogModule, MatDividerModule, MatExpansionModule, MatGridListModule, MatIconModule,
    MatInputModule, MatListModule, MatMenuModule, MatNativeDateModule, MatPaginatorModule,
    MatProgressBarModule, MatProgressSpinnerModule, MatRadioModule, MatRippleModule, MatSelectModule,
    MatSidenavModule, MatSliderModule, MatSlideToggleModule, MatSnackBarModule, MatSortModule,
    MatTableModule, MatTabsModule, MatToolbarModule, MatTooltipModule, MatTreeModule,
    
    NgxDatatableModule, 
    PrettyJsonModule,
    RoundProgressModule,

    appRoutes
  ], 
  // modules needed to run this module
  providers: [
    appRoutingProviders,
    Title,
    AuthGuardService,
    AgensGraphService,  
    AgensDataService,
    AgensUtilService
  ], 
  // additional providers needed for this module
  entryComponents: [ 
    ConfirmDeleteLabelDialog,
    
    ImageExportDialog,
    ProjectOpenDialog,
    ProjectSaveDialog,
    OverlayGraphComponent,

    MetaGraphComponent,
    CellViewerComponent,
    EditGraphComponent,
    TimelineSliderComponent
  ],
  bootstrap: [ AppComponent ]
})
export class AppModule { }
