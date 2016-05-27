Installing an emoticon pack
===========================

Extract the emoticon pack into a subdirectory of this folder, then re-run the
`configure` script before building cadence.

Creating an emoticon pack
=========================

Format
------

An emoticon pack is a folder containing a file named `emoticons.conf` as well as
any number of other files. The folder name itself cannot contain whitespace.

The file `emoticons.conf` must be a valid JSON file, and contain a single object
literal of the following form:

    {
      title: "...",
      icon: "...",
      codes: {
        ...
      },
      aliases: {
        ...
      }
    }

Note: Javascript comments are not valid JSON. All keys are optional, and any
other keys will be ignored.

Interpretation
--------------

* All subkeys of `codes` and `aliases` become emoticons. The key is the
  replacement string, and the value is the corresponding image filename which
  must be in the same folder.

  The replacement string is used as-is, and will be replaced everywhere except
  for `<code>` elements. It is highly recommended to use a consistent and
  distinct syntax such as `:code:` to avoid unintentional emoticons.)

* The `icon` key, if set, must be an image file in the same folder that SHOULD
  be 22x22 pixels large for optimal appearance.

* If `title`, `icon` and `codes` are specified, the emoticon pack will be
  displayed as a sidebar. The tray icons of emoticon packs are displayed in
  alphabetical order between the "Help" and "Settings" buttons.

* If a sidebar is created, all emoticons in `codes` will be shown in it in
  alphabetical order. The emoticons in `aliases` are excluded.
