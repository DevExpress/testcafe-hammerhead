import { Selector } from 'testcafe';

fixture `Some test fixture`
    .page `https://devexpress.github.io/testcafe/example/`;

test('Multiple awaited selector properties in one assertion', async t => {
    throw Error('err');

    const selector = Selector('#developer-name');

    await t.expect(await selector.innerText + await selector.innerText).eql('');
});
