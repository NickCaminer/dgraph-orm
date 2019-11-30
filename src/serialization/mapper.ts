import { plainToClass } from 'class-transformer';

import { ObjectLiteral } from '../utils/type';
import { Constructor } from '../utils/class';
import { DiffTracker } from '../mutation/tracker';

export namespace ObjectMapper {
  class ObjectMapperBuilder<T = any> {
    private _entryType: Constructor<T>;
    private _jsonData: ObjectLiteral<any> | ObjectLiteral<any>[];
    private _resource = new Map<string, ObjectLiteral<any>>();

    addEntryType(type: Constructor<T>) {
      this._entryType = type;
      return this;
    }

    addJsonData(data: ObjectLiteral<any> | ObjectLiteral<any>[]) {
      this._jsonData = data;
      return this;
    }

    /**
     * Walk the resource graph and add all nodes into resource cache by its `uid`.
     */
    addResourceData(data: ObjectLiteral<any> | ObjectLiteral<any>[]) {
      if (data && !(data instanceof Array) && data.uid) {
        this._resource.set(data.uid, data);
        return this;
      }

      data.forEach((d: any) => {
        this.addResourceData(d);
      });

      return this;
    }

    build(): T[] {
      // Do not traverse the json tree if there is no
      // resource data.
      if (this._resource.size > 0) {
        const visited = new Set<string>();
        Array.isArray(this._jsonData)
          ? this._jsonData.map(jd => Private.expand(visited, this._resource, jd))
          : Private.expand(visited, this._resource, this._jsonData);
      }

      const instance: T | T[] = plainToClass(this._entryType as any, this._jsonData);

      if (Array.isArray(instance)) {
        instance.forEach(i => DiffTracker.purgeInstance(i));
        return instance;
      }

      DiffTracker.purgeInstance(instance);
      return [instance];
    }
  }

  export function newBuilder<T = any>() {
    return new ObjectMapperBuilder<T>();
  }
}

/**
 * Module private statics.
 */
namespace Private {
  /**
   * Visit all nodes in a tree recursively, matching node uid in the resource data and adding extra information.
   *
   * ### NOTE
   * Expand will modify the data in-place.
   */
  export function expand(visited: Set<string>, resource: ObjectLiteral<any>, source: ObjectLiteral<any>) {
    if (resource.has(source.uid)) {
      Object.assign(source, resource.get(source.uid));
    }

    Object.keys(source).forEach(key => {
      if (key === 'dgraph.type') {
        return;
      }

      if (!Array.isArray(source[key])) {
        return;
      }

      source[key].forEach((node: any) => {
        const visitingKey = `${source.uid}:${key}:${node.uid}`;
        if (visited.has(visitingKey)) {
          return;
        }

        visited.add(visitingKey);
        return expand(visited, resource, node);
      });
    });
  }
}
