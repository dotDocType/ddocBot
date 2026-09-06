import { bootstrapApplication } from '@angular/platform-browser';
import { provideRouter, withHashLocation } from '@angular/router';
import { defineDdocBot } from '@ddocbot/element';
import { AppComponent } from './app.component';
import { routes } from './training/routes';

defineDdocBot();

bootstrapApplication(AppComponent, {
  providers: [provideRouter(routes, withHashLocation())]
}).catch(error => console.error(error));
