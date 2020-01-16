import { Writer } from '@xanthous/n3';

import { Facet, Node, Predicate, Property, Uid } from '../src';

import { MetadataStorageUtils } from '../src/metadata/storage';
import { ObjectMapper } from '../src/serialization/mapper';
import { MutationBuilder } from '../src/mutation/builder';

describe('Serialize deserialize', () => {
  beforeEach(() => MetadataStorageUtils.flush());

  it('should handle circulars correctly', function() {
    @Node()
    class Hobby {
      @Uid()
      id: string;

      @Property()
      name: string;

      @Property()
      type: string;
    }

    @Node()
    class Person {
      @Uid()
      id: string;

      @Property()
      name: string;

      @Predicate({ type: () => Hobby })
      hobbies: Predicate<Hobby>;
    }

    const data = [
      {
        uid: '0x1',
        'Person.name': 'John',
        'Person.hobbies': [{ uid: '0x2', 'Hobby.type': 'outdoor', 'Hobby.name': 'games' }]
      }
    ];

    const existing = ObjectMapper.newBuilder<Person>()
      .addEntryType(Person)
      .addJsonData(data)
      .build();

    existing[0].hobbies.get()[0].name = 'New Hobby Name';
    console.log(MutationBuilder.getSetNQuadsString(existing[0]));

    const hobby = new Hobby();
    hobby.name = 'Stuff';

    const person = new Person();
    person.name = 'Testing';
    person.hobbies.add(hobby);
    console.log(MutationBuilder.getSetNQuadsString(person));
  });

  it('should handle circulars correctly', function() {
    class PersonKnows {
      @Facet()
      familiarity: number;
    }

    @Node()
    class Person {
      @Uid()
      id: string;

      @Property()
      name: string;

      @Predicate({ type: () => Person, facet: PersonKnows })
      friends: Predicate<Person, PersonKnows>;
    }

    const data = [
      {
        uid: '0x1',
        'Person.name': 'John',
        'Person.friends': [
          {
            uid: '0x2',
            'Person.name': 'Jane',
            'Person.friends|familiarity': 999,
            'Person.friends': [
              {
                uid: '0x3',
                'Person.friends|familiarity': 999,
                'Person.name': 'Kamil'
              }
            ]
          }
        ]
      }
    ];

    const instances = ObjectMapper.newBuilder<Person>()
      .addEntryType(Person)
      .addJsonData(data)
      .build();

    instances[0].name = 'New John';
    const friends = instances[0].friends;

    friends.get()[0].name = 'New Jane';
    instances[0].friends.get()[0].friends.get()[0].name = 'New Kamil';
    friends.getFacet(friends.get()[0])!.familiarity = 666;

    //
    console.log(MutationBuilder.getSetNQuadsString(instances[0]));
  });

  it('should handle circulars correctly for fresh instances', function() {
    class PersonKnows {
      @Facet()
      familiarity: number;
    }

    @Node()
    class Person {
      @Uid()
      id: string;

      @Property()
      name: string;

      @Predicate({ type: () => Person, facet: PersonKnows })
      friends: Predicate<Person, PersonKnows>;
    }

    const john = new Person();
    john.name = 'John';

    const jane = new Person();
    jane.name = 'Jane';

    const kamil = new Person();
    kamil.name = 'Kamil';

    kamil.friends.withFacet({ familiarity: 42 }).add(jane);
    kamil.friends.withFacet({ familiarity: 99 }).add(john);

    //
    console.log(MutationBuilder.getSetNQuadsString(kamil));
  });

  it('should be able to handle reverse edges', function() {
    @Node()
    class Person {
      @Uid()
      id: string;

      @Property()
      name: string;

      @Predicate({ type: () => Person })
      friends: Predicate<Person>;
    }

    const lola = new Person();
    lola.name = 'Lola';

    const john = new Person();
    john.name = 'John';

    const jane = new Person();
    jane.name = 'Jane';

    const kamil = new Person();
    kamil.name = 'Kamil';

    john.friends.add(jane).add(lola);
    jane.friends.add(kamil).add(lola);
    kamil.friends.add(john).add(lola);
    lola.friends
      .add(jane)
      .add(kamil)
      .add(john);

    console.log(MutationBuilder.getSetNQuadsString(john));
    console.log(MutationBuilder.getSetNQuadsString(lola));

    const { quads, nodeMap } = MutationBuilder.getSetNQuads(john);
    console.log(nodeMap.get(john));

    const string = new Writer({ format: 'N-Quads' }).quadsToString(quads);
    console.log(string);

  });
});
