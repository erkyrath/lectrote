GiDispa = function() {

var class_map = {
    'window': {},
    'stream': {},
    'fileref': {}
};
var last_used_id = 101;

function set_vm(vm) {
    console.log('### set_vm', vm);
}

function class_register(clas, obj, usedisprock) {
    console.log('### class_register', clas, obj);

    if (obj.disprock)
        throw new Error('class_register: object is already registered');
    obj.disprock = last_used_id;
    last_used_id++;

    //### or autorestore case

    class_map[clas][obj.disprock] = obj;
}

function class_unregister(clas, obj) {
    console.log('### class_unregister', clas, obj);

    if (!obj.disprock || class_map[clas][obj.disprock] === undefined)
        throw new Error('class_unregister: object is not registered');
    
    delete class_map[clas][obj.disprock];
    obj.disprock = undefined;
}

function prepare_resume(glka0) {
    console.log('### prepare_resume', glka0);
}

return {
    set_vm: set_vm,
    prepare_resume: prepare_resume,
    class_register: class_register,
    class_unregister: class_unregister,
    retain_array: function() {},
    unretain_array: function() {},
};

}();
