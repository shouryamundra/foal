import {
  Class,
  Controller,
  HttpResponseCreated,
  HttpResponseMethodNotAllowed,
  HttpResponseNotFound,
  HttpResponseNotImplemented,
  HttpResponseOK,
  IServiceControllerFactory,
} from '@foal/core';

import { isObjectDoesNotExist } from '../object-does-not-exist';
import { IModelService } from '../services';

export type RouteName = 'DELETE /' | 'DELETE /:id' | 'GET /' | 'GET /:id' | 'PATCH /' | 'PATCH /:id'
  | 'POST /' | 'POST /:id' | 'PUT /' | 'PUT /:id' ;

export class RestControllerFactory implements IServiceControllerFactory {
  public attachService(path: string, ServiceClass: Class<Partial<IModelService>>): Controller<RouteName> {
    const controller = new Controller<RouteName>(path);
    controller.addRoute('DELETE /', 'DELETE', '/', ctx => new HttpResponseMethodNotAllowed());
    controller.addRoute('DELETE /:id', 'DELETE', '/:id', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.removeOne) {
        return new HttpResponseNotImplemented();
      }
      try {
        return new HttpResponseOK(await service.removeOne({ id: ctx.params.id }));
      } catch (err) {
        if (isObjectDoesNotExist(err)) {
          return new HttpResponseNotFound();
        }
        throw err;
      }
    });
    controller.addRoute('GET /', 'GET', '/', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.findMany) {
        return new HttpResponseNotImplemented();
      }
      return new HttpResponseOK(await service.findMany(ctx.state.query || {}));
    });
    controller.addRoute('GET /:id', 'GET', '/:id', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.findOne) {
        return new HttpResponseNotImplemented();
      }
      try {
        return new HttpResponseOK(await service.findOne({ id: ctx.params.id }));
      } catch (err) {
        if (isObjectDoesNotExist(err)) {
          return new HttpResponseNotFound();
        }
        throw err;
      }
    });
    controller.addRoute('PATCH /', 'PATCH', '/', ctx => new HttpResponseMethodNotAllowed());
    controller.addRoute('PATCH /:id', 'PATCH', '/:id', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.updateOne) {
        return new HttpResponseNotImplemented();
      }
      try {
        return new HttpResponseOK(await service.updateOne(ctx.body, { id: ctx.params.id }));
      } catch (err) {
        if (isObjectDoesNotExist(err)) {
          return new HttpResponseNotFound();
        }
        throw err;
      }
    });
    controller.addRoute('POST /', 'POST', '/', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.createOne) {
        return new HttpResponseNotImplemented();
      }
      return new HttpResponseCreated(await service.createOne(ctx.body));
    });
    controller.addRoute('POST /:id', 'POST', '/:id', ctx => new HttpResponseMethodNotAllowed());
    controller.addRoute('PUT /', 'PUT', '/', ctx => new HttpResponseMethodNotAllowed());
    controller.addRoute('PUT /:id', 'PUT', '/:id', async (ctx, services) => {
      const service = services.get(ServiceClass);
      if (!service.updateOne) {
        return new HttpResponseNotImplemented();
      }
      try {
        return new HttpResponseOK(await service.updateOne(ctx.body, { id: ctx.params.id }));
      } catch (err) {
        if (isObjectDoesNotExist(err)) {
          return new HttpResponseNotFound();
        }
        throw err;
      }
    });
    return controller;
  }
}

export const rest = new RestControllerFactory();
