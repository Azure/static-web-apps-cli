# Changelog

## Version 2.13.0

_April 22, 2022_

- **Drop support for ruby 2.5**
- Bump rouge from 3.26.1 to 3.28.0
- Formally support ruby 3.1
- Bump nokogiri from 1.12.5 to 1.13.4
- Build docker images for multiple architectures (e.g. `aarch64`)
- Remove `VOLUME` declaration from Dockerfile (thanks @aemengo)

The security vulnerabilities reported against recent versions of nokogiri should not affect slate users with a regular setup.

## Version 2.12.0

_November 04, 2021_

- Bump nokogiri from 1.12.3 to 1.12.5
- Bump ffi from 1.15.0 to 1.15.4
- Bump rouge from 3.26.0 to 3.26.1
- Bump middleman from 4.4.0 to 4.4.2
- Remove unnecessary files from docker images

## Version 2.11.0

_August 12, 2021_

- **[Security]** Bump addressable transitive dependency from 2.7.0 to 2.8.0
- Support specifying custom meta tags in YAML front-matter
- Bump nokogiri from 1.11.3 to 1.12.3 (minimum supported version is 1.11.4)
- Bump middleman-autoprefixer from 2.10.1 to 3.0.0
- Bump jquery from 3.5.1 to 3.6.0
- Bump middleman from [`d180ca3`](https://github.com/middleman/middleman/commit/d180ca337202873f2601310c74ba2b6b4cf063ec) to 4.4.0

## Version 2.10.0

_April 13, 2021_

- Add support for Ruby 3.0 (thanks @shaun-scale)
- Add requirement for Git on installing dependencies
- Bump nokogiri from 1.11.2 to 1.11.3
- Bump middleman from 4.3.11 to [`d180ca3`](https://github.com/middleman/middleman/commit/d180ca337202873f2601310c74ba2b6b4cf063ec)

## Version 2.9.2

_March 30, 2021_

- **[Security]** Bump kramdown from 2.3.0 to 2.3.1
- Bump nokogiri from 1.11.1 to 1.11.2

## Version 2.9.1

_February 27, 2021_

- Fix Slate language tabs not working if localStorage is disabled

## Version 2.9.0

_January 19, 2021_

- **Drop support for Ruby 2.3 and 2.4**
- **[Security]** Bump nokogiri from 1.10.10 to 1.11.1
- **[Security]** Bump redcarpet from 3.5.0 to 3.5.1
- Specify slate is not supported on Ruby 3.x
- Bump rouge from 3.24.0 to 3.26.0

## Version 2.8.0

_October 27, 2020_

- Remove last trailing newline when using the copy code button
- Rework docker image and make available at slatedocs/slate
- Improve Dockerfile layout to improve caching (thanks @micvbang)
- Bump rouge from 3.20 to 3.24
- Bump nokogiri from 1.10.9 to 1.10.10
- Bump middleman from 4.3.8 to 4.3.11
- Bump lunr.js from 2.3.8 to 2.3.9

## Version 2.7.1

_August 13, 2020_

- **[security]** Bumped middleman from 4.3.7 to 4.3.8

_Note_: Slate uses redcarpet, not kramdown, for rendering markdown to HTML, and so was unaffected by the security vulnerability in middleman.
If you have changed slate to use kramdown, and with GFM, you may need to install the `kramdown-parser-gfm` gem.

## Version 2.7.0

_June 21, 2020_

- **[security]** Bumped rack in Gemfile.lock from 2.2.2 to 2.2.3
- Bumped bundled jQuery from 3.2.1 to 3.5.1
- Bumped bundled lunr from 0.5.7 to 2.3.8
- Bumped imagesloaded from 3.1.8 to 4.1.4
- Bumped rouge from 3.17.0 to 3.20.0
- Bumped redcarpet from 3.4.0 to 3.5.0
- Fix color of highlighted code being unreadable when printing page
- Add clipboard icon for "Copy to Clipboard" functionality to code boxes (see note below)
- Fix handling of ToC selectors that contain punctutation (thanks @gruis)
- Fix language bar truncating languages that overflow screen width
- Strip HTML tags from ToC title before displaying it in title bar in JS (backup to stripping done in Ruby code) (thanks @atic)

To enable the new clipboard icon, you need to add `code_clipboard: true` to the frontmatter of source/index.html.md.
See [this line](https://github.com/slatedocs/slate/blame/main/source/index.html.md#L19) for an example of usage.

## Version 2.6.1

_May 30, 2020_

- **[security]** update child dependency activesupport in Gemfile.lock to 5.4.2.3
- Update Middleman in Gemfile.lock to 4.3.7
- Replace Travis-CI with GitHub actions for continuous integration
- Replace Spectrum with GitHub discussions

## Version 2.6.0

_May 18, 2020_

**Note**: 2.5.0 was "pulled" due to a breaking bug discovered after release. It is recommended to skip it, and move straight to 2.6.0.

- Fix large whitespace gap in middle column for sections with codeblocks
- Fix highlighted code elements having a different background than rest of code block
- Change JSON keys to have a different font color than their values
- Disable asset hashing for woff and woff2 elements due to middleman bug breaking woff2 asset hashing in general
- Move Dockerfile to Debian from Alpine
- Converted repo to a [GitHub template](https://help.github.com/en/github/creating-cloning-and-archiving-repositories/creating-a-template-repository)
- Update sassc to 2.3.0 in Gemfile.lock

## Version 2.5.0

_May 8, 2020_

- **[security]** update nokogiri to ~> 1.10.8
- Update links in example docs to https://github.com/slatedocs/slate from https://github.com/lord/slate
- Update LICENSE to include full Apache 2.0 text
- Test slate against Ruby 2.5 and 2.6 on Travis-CI
- Update Vagrantfile to use Ubuntu 18.04 (thanks @bradthurber)
- Parse arguments and flags for deploy.sh on script start, instead of potentially after building source files
- Install nodejs inside Vagrantfile (thanks @fernandoaguilar)
- Add Dockerfile for running slate (thanks @redhatxl)
- update middleman-syntax and rouge to ~>3.2
- update middleman to 4.3.6

## Version 2.4.0

_October 19, 2019_

- Move repository from lord/slate to slatedocs/slate
- Fix documentation to point at new repo link, thanks to [Arun](https://github.com/slash-arun), [Gustavo Gawryszewski](https://github.com/gawry), and [Daniel Korbit](https://github.com/danielkorbit)
- Update `nokogiri` to 1.10.4
- Update `ffi` in `Gemfile.lock` to fix security warnings, thanks to [Grey Baker](https://github.com/greysteil) and [jakemack](https://github.com/jakemack)
- Update `rack` to 2.0.7 in `Gemfile.lock` to fix security warnings, thanks to [Grey Baker](https://github.com/greysteil) and [jakemack](https://github.com/jakemack)
- Update middleman to `4.3` and relax constraints on middleman related gems, thanks to [jakemack](https://github.com/jakemack)
- Add sass gem, thanks to [jakemack](https://github.com/jakemack)
- Activate `asset_cache` in middleman to improve cacheability of static files, thanks to [Sam Gilman](https://github.com/thenengah)
- Update to using bundler 2 for `Gemfile.lock`, thanks to [jakemack](https://github.com/jakemack)

## Version 2.3.1

_July 5, 2018_

- Update `sprockets` in `Gemfile.lock` to fix security warnings

## Version 2.3

_July 5, 2018_

- Allows strikethrough in markdown by default.
- Upgrades jQuery to 3.2.1, thanks to [Tomi Takussaari](https://github.com/TomiTakussaari)
- Fixes invalid HTML in `layout.erb`, thanks to [Eric Scouten](https://github.com/scouten) for pointing out
- Hopefully fixes Vagrant memory issues, thanks to [Petter Blomberg](https://github.com/p-blomberg) for the suggestion
- Cleans HTML in headers before setting `document.title`, thanks to [Dan Levy](https://github.com/justsml)
- Allows trailing whitespace in markdown files, thanks to [Samuel Cousin](https://github.com/kuzyn)
- Fixes pushState/replaceState problems with scrolling not changing the document hash, thanks to [Andrey Fedorov](https://github.com/anfedorov)
- Removes some outdated examples, thanks [@al-tr](https://github.com/al-tr), [Jerome Dahdah](https://github.com/jdahdah), and [Ricardo Castro](https://github.com/mccricardo)
- Fixes `nav-padding` bug, thanks [Jerome Dahdah](https://github.com/jdahdah)
- Code style fixes thanks to [Sebastian Zaremba](https://github.com/vassyz)
- Nokogiri version bump thanks to [Grey Baker](https://github.com/greysteil)
- Fix to default `index.md` text thanks to [Nick Busey](https://github.com/NickBusey)

Thanks to everyone who contributed to this release!

## Version 2.2

_January 19, 2018_

- Fixes bugs with some non-roman languages not generating unique headers
- Adds editorconfig, thanks to [Jay Thomas](https://github.com/jaythomas)
- Adds optional `NestingUniqueHeadCounter`, thanks to [Vladimir Morozov](https://github.com/greenhost87)
- Small fixes to typos and language, thx [Emir Ribić](https://github.com/ribice), [Gregor Martynus](https://github.com/gr2m), and [Martius](https://github.com/martiuslim)!
- Adds links to Spectrum chat for questions in README and ISSUE_TEMPLATE

## Version 2.1

_October 30, 2017_

- Right-to-left text stylesheet option, thanks to [Mohammad Hossein Rabiee](https://github.com/mhrabiee)
- Fix for HTML5 history state bug, thanks to [Zach Toolson](https://github.com/ztoolson)
- Small styling changes, typo fixes, small bug fixes from [Marian Friedmann](https://github.com/rnarian), [Ben Wilhelm](https://github.com/benwilhelm), [Fouad Matin](https://github.com/fouad), [Nicolas Bonduel](https://github.com/NicolasBonduel), [Christian Oliff](https://github.com/coliff)

Thanks to everyone who submitted PRs for this version!

## Version 2.0

_July 17, 2017_

- All-new statically generated table of contents
  - Should be much faster loading and scrolling for large pages
  - Smaller Javascript file sizes
  - Avoids the problem with the last link in the ToC not ever highlighting if the section was shorter than the page
  - Fixes control-click not opening in a new page
  - Automatically updates the HTML title as you scroll
- Updated design
  - New default colors!
  - New spacings and sizes!
  - System-default typefaces, just like GitHub
- Added search input delay on large corpuses to reduce lag
- We even bumped the major version cause hey, why not?
- Various small bug fixes

Thanks to everyone who helped debug or wrote code for this version! It was a serious community effort, and I couldn't have done it alone.

## Version 1.5

_February 23, 2017_

- Add [multiple tabs per programming language](https://github.com/lord/slate/wiki/Multiple-language-tabs-per-programming-language) feature
- Upgrade Middleman to add Ruby 1.4.0 compatibility
- Switch default code highlighting color scheme to better highlight JSON
- Various small typo and bug fixes

## Version 1.4

_November 24, 2016_

- Upgrade Middleman and Rouge gems, should hopefully solve a number of bugs
- Update some links in README
- Fix broken Vagrant startup script
- Fix some problems with deploy.sh help message
- Fix bug with language tabs not hiding properly if no error
- Add `!default` to SASS variables
- Fix bug with logo margin
- Bump tested Ruby versions in .travis.yml

## Version 1.3.3

_June 11, 2016_

Documentation and example changes.

## Version 1.3.2

_February 3, 2016_

A small bugfix for slightly incorrect background colors on code samples in some cases.

## Version 1.3.1

_January 31, 2016_

A small bugfix for incorrect whitespace in code blocks.

## Version 1.3

_January 27, 2016_

We've upgraded Middleman and a number of other dependencies, which should fix quite a few bugs.

Instead of `rake build` and `rake deploy`, you should now run `bundle exec middleman build --clean` to build your server, and `./deploy.sh` to deploy it to Github Pages.

## Version 1.2

_June 20, 2015_

**Fixes:**

- Remove crash on invalid languages
- Update Tocify to scroll to the highlighted header in the Table of Contents
- Fix variable leak and update search algorithms
- Update Python examples to be valid Python
- Update gems
- More misc. bugfixes of Javascript errors
- Add Dockerfile
- Remove unused gems
- Optimize images, fonts, and generated asset files
- Add chinese font support
- Remove RedCarpet header ID patch
- Update language tabs to not disturb existing query strings

## Version 1.1

_July 27, 2014_

**Fixes:**

- Finally, a fix for the redcarpet upgrade bug

## Version 1.0

_July 2, 2014_

[View Issues](https://github.com/tripit/slate/issues?milestone=1&state=closed)

**Features:**

- Responsive designs for phones and tablets
- Started tagging versions

**Fixes:**

- Fixed 'unrecognized expression' error
- Fixed #undefined hash bug
- Fixed bug where the current language tab would be unselected
- Fixed bug where tocify wouldn't highlight the current section while searching
- Fixed bug where ids of header tags would have special characters that caused problems
- Updated layout so that pages with disabled search wouldn't load search.js
- Cleaned up Javascript
