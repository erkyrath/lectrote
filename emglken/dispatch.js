/*

Emglken dispatch layer
======================

Copyright (c) 2018 Dannii Willis
MIT licenced
https://github.com/curiousdannii/emglken

*/

const class_ids_to_codes = {
    window: 0,
    stream: 1,
    fileref: 2,
    schannel: 3,
}

const argUint8 = {
    serialize: () => 0,
}

const argUint32 = {
    serialize: () => 1,
}

class EmglkenDispatch
{
    constructor()
    {
        this.class_map = {
            'fileref': {},
            'stream': {},
            'window': {},
        }
        this.last_used_id = 101
        this.retained_arrays = []
    }

    check_autosave()
    {
        return this.vm.running_glk_select
    }

    class_obj_from_id( clas, val )
    {
        return this.class_map[clas][val]
    }

    class_obj_to_id( clas, val )
    {
        if ( !val )
        {
            return 0
        }
        return val.disprock
    }

    class_register( clas, obj, usedisprock )
    {
        if ( usedisprock )
        {
            if ( obj.disprock !== usedisprock )
            {
                throw new Error( 'class_register: object is not already registered' )
            }
            if ( this.last_used_id <= usedisprock )
            {
                this.last_used_id = usedisprock + 1
            }
        }
        else
        {
            if ( obj.disprock )
            {
                throw new Error( 'class_register: object is already registered' )
            }
            obj.disprock = this.last_used_id++
        }
        this.class_map[clas][obj.disprock] = obj
        obj.addr = this.vm.vm._glem_register_obj( class_ids_to_codes[clas], obj.disprock, obj.rock )
    }

    class_unregister( clas, obj )
    {
        if ( !obj.disprock || this.class_map[clas][obj.disprock] == null )
        {
            throw new Error( 'class_unregister: object is not registered' )
        }
        delete this.class_map[clas][obj.disprock]
        obj.disprock = null
        this.vm.vm._glem_unregister_obj( class_ids_to_codes[clas], obj.addr )
    }

    get_retained_array( arr )
    {
        return this.retained_arrays.filter( r => r.origarr === arr )[0]
    }

    prepare_resume()
    {}

    retain_array( arr, data )
    {
        if ( data )
        {
            const unicode = data.unicode || data.arg
            this.retained_arrays.push({
                addr: data.addr,
                get arr() { return Array.from( arr ) },
                arg: unicode ? argUint32 : argUint8,
                len: arr.length,
                objaddr: data.objaddr,
                origarr: arr,
            })
            this.vm.vm._glem_register_arr( data.objaddr, data.addr, arr.length, unicode )
        }
    }

    set_vm( vm )
    {
        this.vm = vm
    }

    unretain_array( arr )
    {
        const data = this.retained_arrays.filter( r => r.origarr === arr )[0]
        this.retained_arrays = this.retained_arrays.filter( r => r.origarr !== arr )

        if ( data )
        {
            const unicode = data.arg.serialize()
            // This is an array from an autorestore, so we need to manually write back to the VM
            if ( !data.origarr.buffer )
            {
                this.vm.vm.HEAPU8.set( new Uint8Array( unicode ? Uint32Array.from( data.origarr ).buffer : data.origarr ), data.addr )
            }

            // Unregister the array, but not if currently running glk_select, in which case we need to run it afterwards
            if ( this.vm.running_glk_select )
            {
                this.vm.pending_unregister_arr = [ data.objaddr, data.addr, arr.length, unicode ]
            }
            else
            {
                this.vm.vm._glem_unregister_arr( data.objaddr, data.addr, arr.length, unicode )
            }
        }
    }
}

// Export the class and an instance
if ( typeof module === 'object' && module.exports )
{
    module.exports = EmglkenDispatch
}
if ( typeof window !== 'undefined' )
{
    window.GiDispa = new EmglkenDispatch()
}