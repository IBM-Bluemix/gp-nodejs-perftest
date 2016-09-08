module.exports = function testData(s) {
    var o = {};
    for(var i=0; i<s; i++) {
        const k = 'k'+i;
        const v = [
            ['The','Some','All'],
            ['main','alternate'],
            ['pump','generator','wheel'],
            ['fixing','extirpating','charging','calibrating'],
            ['screws','bolts','hammers','ostriches','buckets'],
            ['with','of','from','to','in','by'],
            ['the','a(n)'],
            ['correct','incorrect'],
            ['strength','torsion','frequency'],
            ['class','rating','general category']
        ].map((a,n) => a[i%a.length]).join(' ')+'.';

        o[k] = v;
    }

    return o;
};