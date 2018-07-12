import { Routes, RouterModule } from '@angular/router';

import { AuthGuardService } from './services/auth-guard.service';
import { LoginComponent } from './login/login.component';

import { MainComponent } from './main/main.component';
import { DashboardComponent } from './main/dashboard/dashboard.component';
import { GraphComponent } from './main/graph/graph.component';
import { HistoryComponent } from './main/history/history.component';


const routes: Routes = [
  { path: 'login', component: LoginComponent },
  { path: '', component: MainComponent, canActivate: [AuthGuardService]
    , children: [
      { path: '', component: DashboardComponent }
      ,{ path: 'graph', component: GraphComponent }
      ,{ path: 'graph/:oid', component: GraphComponent }
      ,{ path: 'history', component: HistoryComponent }
    ]},
  // all other routes
  { path: '**', redirectTo: '' }
];

export const appRoutingProviders: any[] = [

];

export const appRoutes: any = RouterModule.forRoot(routes, { useHash: true });
