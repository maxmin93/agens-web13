import { Routes, RouterModule } from '@angular/router';

import { AuthGuardService } from './services/auth-guard.service';
import { LoginComponent } from './login/login.component';

import { MainComponent } from './main/main.component';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { PlpyEditorComponent } from './main/plpy-editor/plpy-editor.component';
import { GraphComponent } from './main/graph/graph.component';
import { HistoryComponent } from './main/history/history.component';

import { ReportComponent } from './report/report.component';

const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: MainComponent, canActivate: [AuthGuardService]
    , children: [
      { path: '', component: DashboardComponent }
      ,{ path: 'pyeditor', component: PlpyEditorComponent }
      ,{ path: 'graph', component: GraphComponent }
      ,{ path: 'history', component: HistoryComponent }
    ]},
  { path: 'report/:guestKey/:pid', component: ReportComponent },
  // all other routes
  { path: '**', redirectTo: '' }
];

export const appRoutingProviders: any[] = [

];

export const appRoutes: any = RouterModule.forRoot(routes, { useHash: true });
