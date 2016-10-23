Installing an emoticon pack
===========================

Extract the emoticon pack into a subdirectory of this folder, then re-run the
`configure` script before building cadence.

Creating an emoticon pack
=========================

Format
------

An emoticon pack is a folder containing a file named `emoticons.yml` as well as
any number of other files. The folder name itself cannot contain whitespace.

The file `emoticons.yml` must be a valid YAML file, and use this format:

    title: ...
    icon: ...
    codes:
      :example:: example.png
    aliases:
      :alias:: example.png

The `codes` key is required. `title` and `icon` are only needed for a sidebar;
`aliases` is only needed for codes that should not be in the sidebar.

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

* If a sidebar is created, all emoticons in `codes` will be shown in it, preserving
  the order as defined in this file. The emoticons in `aliases` are excluded.
