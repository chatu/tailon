package main

import (
	"os"
	"path"
	"path/filepath"
	"sort"
	"time"
)

// ListEntry is an entry that appears in the UI file input. All FileSpecs ultimately  result in  one or more ListEntry instances, which  the server ships off to the client.
type ListEntry struct {
	Path    string    `json:"path"`
	Alias   string    `json:"alias"`
	Size    int64     `json:"size"`
	ModTime time.Time `json:"mtime"`
	Exists  bool      `json:"exists"`
}

func fileInfo(path string) *ListEntry {
	entry := ListEntry{}
	entry.Path = path

	info, err := os.Stat(path)
	if !os.IsNotExist(err) {
		entry.Exists = true
		entry.Size = info.Size()
		entry.ModTime = info.ModTime()
	}

	return &entry
}

var allFiles map[string]bool

func createListing(filespecs []FileSpec, desiredGroup string) map[string][]*ListEntry {
	allFiles = make(map[string]bool)
	res := make(map[string][]*ListEntry)

	for _, spec := range filespecs {
		group := "__default__"
		if spec.Group != "" {
			group = spec.Group
		}

		switch spec.Type {
		case "file":
			entry := fileInfo(spec.Path)
			if spec.Alias != "" {
				entry.Alias = spec.Alias
			} else {
				entry.Alias = entry.Path
			}
			if desiredGroup == "" || group == desiredGroup {
				res[group] = append(res[group], entry)
			}
			allFiles[entry.Path] = true
		case "glob":
			matches, _ := filepath.Glob(spec.Path)
			sort.Sort(sort.Reverse(sort.StringSlice(matches)))
			for _, match := range matches {
				entry := fileInfo(match)
				if spec.Alias != "" {
					entry.Alias = path.Join(spec.Alias, path.Base(entry.Path))
				} else {
					cwd, _ := os.Getwd()
					rel, _ := filepath.Rel(cwd, entry.Path)
					entry.Alias = rel
				}
				if desiredGroup == "" || group == desiredGroup {
					res[group] = append(res[group], entry)
				}
				allFiles[entry.Path] = true
			}
		}
	}

	return res
}

func fileAllowed(path string) bool {
	_, ok := allFiles[path]
	return ok
}
