import functools

def merge_objects(a, *c):
    return functools.reduce(_merge_objects, c, a)

def _merge_objects(a, b):
    # If a is a dict, either merge or ignore b.
    if type(a) is dict:
        if type(b) is dict:
            for key in a.keys() & b.keys():
                a[key] = _merge_objects(a[key], b[key])
    # Override lists only with lists, but anything else with anything.
    elif (type(a) is list) <= (type(b) is list):
        return b
    return a
