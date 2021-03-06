import { Expose } from 'class-transformer';
import { MetadataStorage } from '../metadata/storage';

export function Uid() {
  return function(target: Object, propertyName: string): void {
    // Expose the uid json property to class.
    Expose({ name: 'uid', toClassOnly: true })(target, propertyName);
    MetadataStorage.Instance.addUidMetadata({ target, propertyName });
  };
}
